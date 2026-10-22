from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, date
from app.database import get_db
from app.models.schedule import Schedule
from app.models.medication import Medication
from app.models.user import User
from app.models.interaction_log import InteractionLog
from app.schemas.schedule import ScheduleCreate, ScheduleResponse, ElderRespondRequest
from app.voice.tts_service import (
    generate_reminder_speech,
    generate_confirmation_speech,
    generate_unsure_speech,
    generate_help_speech
)
from app.core.notifier import send_telegram_alert

router = APIRouter(prefix="/api/schedules", tags=["Schedules"])

@router.get("/")
def get_schedules_with_status(elder_id: int = None, db: Session = Depends(get_db)):
    """
    Lấy danh sách các cữ thuốc cùng với các loại thuốc và trạng thái sự kiện hôm nay.
    """
    query = db.query(Schedule).filter(Schedule.is_active == True)
    if elder_id:
        query = query.filter(Schedule.elder_id == elder_id)
    schedules = query.all()

    today_str = date.today().isoformat()
    result = []

    for sch in schedules:
        # Lấy danh sách thuốc của cữ này
        meds = db.query(Medication).filter(
            Medication.elder_id == sch.elder_id,
            Medication.time_period == sch.time_period,
            Medication.is_active == True
        ).all()

        # Kiểm tra các sự kiện độc lập trong ngày hôm nay
        start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        logs = db.query(InteractionLog).filter(
            InteractionLog.schedule_id == sch.id,
            InteractionLog.timestamp >= start_of_day
        ).all()

        user_responded = any(l.event_type == "user_responded" for l in logs)
        device_recorded = any(l.event_type == "device_recorded" for l in logs)
        caregiver_confirmed = any(l.event_type == "caregiver_confirmed" for l in logs)

        # Lấy CV status gần nhất nếu có
        cv_logs = [l for l in logs if l.cv_status and l.cv_status != "NONE"]
        latest_cv_status = cv_logs[-1].cv_status if cv_logs else "NONE"

        result.append({
            "id": sch.id,
            "elder_id": sch.elder_id,
            "time_period": sch.time_period,
            "target_time": sch.target_time,
            "verified_by": sch.verified_by,
            "verified_at": sch.verified_at,
            "notes": sch.notes,
            "medications": [
                {"id": m.id, "name": m.name, "dosage": m.dosage, "instruction": m.instruction}
                for m in meds
            ],
            # 3 TRẠNG THÁI TÁCH BẠCH ĐỘC LẬP
            "status": {
                "user_responded": user_responded,
                "device_recorded": device_recorded,
                "caregiver_confirmed": caregiver_confirmed,
                "cv_status": latest_cv_status
            }
        })

    return result

@router.post("/", response_model=ScheduleResponse)
def create_schedule(sch_in: ScheduleCreate, db: Session = Depends(get_db)):
    """
    Tạo lịch dùng thuốc mới. BẮT BUỘC phải có verified_by.
    """
    if not sch_in.verified_by:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lịch dùng thuốc bắt buộc phải có verified_by (ID người chăm sóc chịu trách nhiệm xác minh)"
        )
    verifier = db.query(User).filter(User.id == sch_in.verified_by).first()
    if not verifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Người xác minh (verified_by) không tồn tại trong hệ thống"
        )

    db_sch = Schedule(
        elder_id=sch_in.elder_id,
        time_period=sch_in.time_period,
        target_time=sch_in.target_time,
        notes=sch_in.notes,
        verified_by=sch_in.verified_by,
        verified_at=datetime.utcnow(),
        is_active=sch_in.is_active
    )
    db.add(db_sch)
    db.commit()
    db.refresh(db_sch)
    return db_sch

@router.post("/{schedule_id}/remind")
async def trigger_schedule_reminder(schedule_id: int, db: Session = Depends(get_db)):
    """
    Phát thông báo nhắc nhở cữ thuốc qua giọng đọc tiếng Việt.
    Ghi nhận sự kiện 'reminder_sent' bất biến vào InteractionLog.
    """
    sch = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sch:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch")

    meds = db.query(Medication).filter(
        Medication.elder_id == sch.elder_id,
        Medication.time_period == sch.time_period,
        Medication.is_active == True
    ).all()
    med_names = [m.name for m in meds]

    audio_file, speech_text = await generate_reminder_speech("Bác", sch.time_period, med_names)

    # Ghi nhận sự kiện reminder_sent
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

    return {
        "success": True,
        "event_type": "reminder_sent",
        "speech_text": speech_text,
        "audio_url": f"/storage/audio_cache/{audio_file}" if audio_file else None,
        "medications": med_names
    }

@router.post("/{schedule_id}/respond")
async def elder_respond(schedule_id: int, req: ElderRespondRequest, db: Session = Depends(get_db)):
    """
    Người cao tuổi tương tác qua 3 nút bấm hoặc giọng nói:
    - HEARD: Đã nghe nhắc / Đã uống xong -> Phát âm thanh chuông + đọc to tên từng loại thuốc đã uống!
    - UNSURE: Chưa chắc chắn -> Trấn an, chuyển người nhà kiểm tra.
    - HELP: Cần trợ giúp khẩn cấp -> Gửi Telegram báo động.
    """
    sch = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sch:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch")

    meds = db.query(Medication).filter(
        Medication.elder_id == sch.elder_id,
        Medication.time_period == sch.time_period,
        Medication.is_active == True
    ).all()
    med_names = [m.name for m in meds]

    if req.response_type.upper() == "HEARD":
        # 1. Sinh audio đọc to tên thuốc
        audio_file, speech_text = await generate_confirmation_speech("Bác", sch.time_period, med_names)

        # 2. Ghi nhận sự kiện user_responded (Người cao tuổi phản hồi, KHÔNG gộp với device_recorded)
        log1 = InteractionLog(
            schedule_id=sch.id,
            elder_id=sch.elder_id,
            event_type="user_responded",
            response_content="Đã nghe nhắc và uống thuốc",
            audio_url=f"/storage/audio_cache/{audio_file}" if audio_file else None,
            notes=f"Đã ghi nhận các thuốc: {', '.join(med_names)}",
            timestamp=datetime.utcnow()
        )
        db.add(log1)
        db.commit()

        return {
            "success": True,
            "status": "HEARD_CONFIRMED",
            "message": "Đã ghi nhận cữ uống thuốc",
            "medications": med_names,
            "speech_text": speech_text,
            "audio_url": f"/storage/audio_cache/{audio_file}" if audio_file else None
        }

    elif req.response_type.upper() == "UNSURE":
        audio_file, speech_text = await generate_unsure_speech("Bác")
        log = InteractionLog(
            schedule_id=sch.id,
            elder_id=sch.elder_id,
            event_type="user_responded",
            response_content="Chưa chắc chắn về thuốc",
            notes="Người già báo chưa chắc chắn, cần người nhà hỗ trợ kiểm tra",
            timestamp=datetime.utcnow()
        )
        db.add(log)
        db.commit()

        # Báo Telegram cho người nhà
        await send_telegram_alert(
            f"ℹ️ <b>BÁC BÁO CHƯA CHẮC CHẮN VỀ THUỐC</b>\n"
            f"Cữ thuốc: {sch.time_period} ({sch.target_time})\n"
            f"Đề nghị người chăm sóc kiểm tra lại khay thuốc giúp bác."
        )

        return {
            "success": True,
            "status": "UNSURE_REPORTED",
            "speech_text": speech_text,
            "audio_url": f"/storage/audio_cache/{audio_file}" if audio_file else None
        }

    else: # HELP
        audio_file, speech_text = await generate_help_speech("Bác")
        log = InteractionLog(
            schedule_id=sch.id,
            elder_id=sch.elder_id,
            event_type="alert",
            response_content="Yêu cầu trợ giúp khẩn cấp",
            notes="Người cao tuổi bấm nút CẦN GIÚP ĐỠ",
            timestamp=datetime.utcnow()
        )
        db.add(log)
        db.commit()

        # Báo động đỏ Telegram
        await send_telegram_alert(
            f"🚨 <b>KHẨN CẤP: BÁC YÊU CẦU TRỢ GIÚP TỪ MÀN HÌNH KIOSK!</b>\n"
            f"Thời điểm: {datetime.now().strftime('%H:%M:%S')}\n"
            f"Gia đình hãy gọi điện cho bác ngay lập tức!"
        )

        return {
            "success": True,
            "status": "HELP_TRIGGERED",
            "speech_text": speech_text,
            "audio_url": f"/storage/audio_cache/{audio_file}" if audio_file else None
        }
