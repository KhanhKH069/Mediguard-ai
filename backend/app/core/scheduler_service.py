"""
MediGuard AI - Scheduler Service (Hệ thống lập lịch & Giám sát an toàn)
1. Tự động kích hoạt thông báo nhắc thuốc theo giờ đã định.
2. Bộ giám sát quá hạn (Timeout Watcher): Nếu sau NO_RESPONSE_MINUTES mà bác chưa
   bấm phản hồi thì tự động gửi cảnh báo khẩn cấp cho người thân qua Telegram.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import asyncio
import logging
from app.config import NO_RESPONSE_MINUTES
from app.database import SessionLocal
from app.models.schedule import Schedule
from app.models.medication import Medication
from app.models.user import User
from app.models.interaction_log import InteractionLog
from app.core.notifier import send_telegram_alert
from app.voice.tts_service import generate_reminder_speech
from app.api.websocket import broadcast_sync

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()

def check_unresponsive_elders():
    """
    Watcher chạy định kỳ mỗi phút:
    Tìm các lời nhắc đã phát > NO_RESPONSE_MINUTES mà người cao tuổi chưa có phản hồi.
    """
    db = SessionLocal()
    try:
        cutoff_time = datetime.utcnow() - timedelta(minutes=NO_RESPONSE_MINUTES)
        
        # 1. Lấy tất cả sự kiện 'reminder_sent' đã phát trước thời điểm cutoff
        recent_reminders = db.query(InteractionLog).filter(
            InteractionLog.event_type == "reminder_sent",
            InteractionLog.timestamp <= cutoff_time,
            InteractionLog.timestamp >= datetime.utcnow() - timedelta(hours=3) # Trong vòng 3 tiếng gần nhất
        ).all()

        for reminder in recent_reminders:
            # 2. Kiểm tra xem sau lần nhắc này đã có user_responded hoặc caregiver_confirmed chưa
            has_response = db.query(InteractionLog).filter(
                InteractionLog.schedule_id == reminder.schedule_id,
                InteractionLog.event_type.in_(["user_responded", "caregiver_confirmed"]),
                InteractionLog.timestamp >= reminder.timestamp
            ).first()

            if not has_response:
                # 3. Kiểm tra xem hệ thống đã gửi cảnh báo 'alert' cho cữ này chưa (tránh spam)
                alert_already_sent = db.query(InteractionLog).filter(
                    InteractionLog.schedule_id == reminder.schedule_id,
                    InteractionLog.event_type == "alert",
                    InteractionLog.timestamp >= reminder.timestamp
                ).first()

                if not alert_already_sent:
                    # Ghi nhận sự kiện cảnh báo bất biến vào DB
                    alert_log = InteractionLog(
                        schedule_id=reminder.schedule_id,
                        elder_id=reminder.elder_id,
                        event_type="alert",
                        notes=f"Cảnh báo: Đã quá {NO_RESPONSE_MINUTES} phút kể từ lời nhắc mà bác chưa phản hồi.",
                        timestamp=datetime.utcnow()
                    )
                    db.add(alert_log)
                    db.commit()

                    msg = (
                        f"⚠️ <b>NGƯỜI THÂN CHƯA PHẢN HỒI LỊCH THUỐC!</b>\n"
                        f"• Thời điểm nhắc: {reminder.timestamp.strftime('%H:%M:%S')}\n"
                        f"• Thời gian chờ: Đã hơn {NO_RESPONSE_MINUTES} phút\n"
                        f"• Trạng thái: Chưa nhận được phản hồi qua màn hình Kiosk.\n"
                        f"👉 <i>Đề nghị gia đình chủ động gọi điện kiểm tra sức khỏe của bác!</i>"
                    )
                    # Chạy gửi telegram không chặn
                    try:
                        asyncio.run(send_telegram_alert(msg))
                    except Exception as ex:
                        logger.error(f"Lỗi gửi cảnh báo telegram trong watcher: {ex}")

    except Exception as e:
        logger.error(f"Lỗi trong check_unresponsive_elders: {e}")

def check_scheduled_reminders():
    """
    Watcher chạy định kỳ mỗi phút:
    Tự động quét các lịch dùng thuốc khớp với giờ hiện tại (HH:MM).
    Nếu đến giờ mà hôm nay chưa phát chuông nhắc cữ này -> tự động phát chuông,
    tạo giọng đọc TTS, ghi log 'reminder_sent' và phát WebSocket cho Kiosk.
    """
    db = SessionLocal()
    try:
        now = datetime.now()
        current_time_str = now.strftime("%H:%M")
        start_of_day_utc = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        schedules = db.query(Schedule).filter(
            Schedule.is_active == True,
            Schedule.target_time == current_time_str
        ).all()

        for sch in schedules:
            already_reminded = db.query(InteractionLog).filter(
                InteractionLog.schedule_id == sch.id,
                InteractionLog.event_type == "reminder_sent",
                InteractionLog.timestamp >= start_of_day_utc
            ).first()

            if already_reminded:
                continue

            elder = db.query(User).filter(User.id == sch.elder_id).first()
            elder_name = elder.full_name if elder else "Bác"

            meds = db.query(Medication).filter(
                Medication.elder_id == sch.elder_id,
                Medication.time_period == sch.time_period,
                Medication.is_active == True
            ).all()
            med_names = [m.name for m in meds]

            try:
                audio_file, speech_text = asyncio.run(generate_reminder_speech(elder_name, sch.time_period, med_names))
            except Exception as e:
                logger.warning(f"Lỗi tạo audio nhắc lịch tự động: {e}")
                audio_file = ""
                speech_text = f"Kính chào {elder_name}! Đã đến giờ dùng thuốc buổi {sch.time_period.lower()} rồi ạ."

            log_entry = InteractionLog(
                schedule_id=sch.id,
                elder_id=sch.elder_id,
                event_type="reminder_sent",
                response_content=speech_text,
                audio_url=f"/storage/audio_cache/{audio_file}" if audio_file else None,
                timestamp=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()

            logger.info(f"Đã tự động kích hoạt lời nhắc cho lịch #{sch.id} ({sch.time_period} {sch.target_time})")

            broadcast_sync("reminder_sent", {
                "schedule_id": sch.id,
                "elder_id": sch.elder_id,
                "time_period": sch.time_period,
                "target_time": sch.target_time,
                "speech_text": speech_text,
                "audio_url": f"/storage/audio_cache/{audio_file}" if audio_file else None,
                "medications": med_names,
                "timestamp": datetime.utcnow().isoformat()
            })
    except Exception as e:
        logger.error(f"Lỗi trong check_scheduled_reminders: {e}")
    finally:
        db.close()

def start_scheduler():
    """
    Khởi động Scheduler chạy nền.
    """
    if not scheduler.running:
        scheduler.add_job(check_unresponsive_elders, 'interval', minutes=1, id="unresponsive_watcher")
        scheduler.add_job(check_scheduled_reminders, 'interval', minutes=1, id="scheduled_reminder_trigger")
        scheduler.start()
        logger.info("Scheduler Service đã khởi chạy thành công (Watcher + Auto Reminder Trigger).")

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
