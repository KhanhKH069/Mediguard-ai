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
from app.models.interaction_log import InteractionLog
from app.core.notifier import send_telegram_alert

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
    finally:
        db.close()

def start_scheduler():
    """
    Khởi động Scheduler chạy nền.
    """
    if not scheduler.running:
        scheduler.add_job(check_unresponsive_elders, 'interval', minutes=1, id="unresponsive_watcher")
        scheduler.start()
        logger.info("Scheduler Service đã khởi chạy thành công.")

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
