from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.database import get_db
from app.models.schedule import Schedule
from app.models.medication import Medication
from app.models.interaction_log import InteractionLog
from app.voice.tts_service import text_to_speech
from app.config import DEFAULT_VIETNAMESE_VOICE, DEFAULT_VOICE_RATE
from app.core.rule_engine import evaluate_safety_and_intent
from app.core.notifier import send_telegram_alert

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["Voice"])

class SpeakRequest(BaseModel):
    text: str
    voice: str | None = None
    rate: str | None = None

class VoiceProcessRequest(BaseModel):
    user_speech: str
    elder_id: Optional[int] = None
    voice: str | None = None
    rate: str | None = None

@router.post("/speak")
async def speak_text(req: SpeakRequest):
    """
    Tạo giọng đọc tiếng Việt chuẩn Edge-TTS từ văn bản bất kỳ.
    Có cache theo hash nội dung để phản hồi tức thời.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Thiếu nội dung văn bản")
    voice = req.voice or DEFAULT_VIETNAMESE_VOICE
    rate = req.rate or DEFAULT_VOICE_RATE
    audio_file = await text_to_speech(req.text.strip(), voice=voice, rate=rate)
    if not audio_file:
        raise HTTPException(status_code=500, detail="Không thể tạo file âm thanh tiếng Việt")
    return {
        "success": True,
        "text": req.text,
        "audio_url": f"/storage/audio_cache/{audio_file}"
    }

@router.post("/process")
async def process_voice(req: VoiceProcessRequest, db: Session = Depends(get_db)):
    """
    Tiếp nhận câu nói tiếng Việt của người già, phân tích an toàn,
    sinh câu thoại phản hồi bằng giọng nói tiếng Việt Edge-TTS,
    đồng thời lưu vết vào Nhật ký kiểm toán y tế (InteractionLog).
    """
    if not req.user_speech or not req.user_speech.strip():
        raise HTTPException(status_code=400, detail="Thiếu câu nói của người dùng")

    analysis = evaluate_safety_and_intent(req.user_speech)
    reply_text = analysis.get("reply_speech") or "Cháu đã ghi nhận thông tin của bác rồi ạ!"
    
    voice = req.voice or DEFAULT_VIETNAMESE_VOICE
    rate = req.rate or DEFAULT_VOICE_RATE

    # Xử lý động khi người dùng hỏi thuốc của cữ
    if analysis.get("intent") == "INQUIRE_MEDICATION":
        current_hour = datetime.now().hour
        if 4 <= current_hour < 11:
            period = "Sáng"
        elif 11 <= current_hour < 15:
            period = "Trưa"
        elif 15 <= current_hour < 22:
            period = "Tối"
        else:
            period = "Đêm"

        elder_id = req.elder_id or 1
        meds = db.query(Medication).filter(
            Medication.elder_id == elder_id,
            Medication.time_period == period,
            Medication.is_active == True
        ).all()

        if meds:
            med_list = [f"{m.name} ({m.dosage}, {m.instruction})" for m in meds]
            reply_text = (
                f"Dạ thưa Bác, theo đơn thuốc đã được gia đình xác minh, cữ {period.lower()} nay Bác có: "
                f"{'; '.join(med_list)}. Bác nhớ uống kèm nước ấm nhé ạ!"
            )
        else:
            reply_text = f"Dạ thưa Bác, trong cữ {period.lower()} này Bác không có loại thuốc nào cần uống theo đơn đã xác minh ạ."

    audio_file = await text_to_speech(reply_text, voice=voice, rate=rate)

    # Nếu người dùng báo uống thuốc thành công, tự động ghi nhận vào InteractionLog
    if analysis.get("intent") == "CONFIRM_INTAKE":
        try:
            active_sch = db.query(Schedule).filter(Schedule.is_active == True).first()
            if active_sch:
                log_entry = InteractionLog(
                    schedule_id=active_sch.id,
                    elder_id=active_sch.elder_id,
                    event_type="user_responded",
                    response_content=req.user_speech,
                    notes="Xác nhận uống thuốc bằng đối thoại giọng nói AI",
                    audio_url=f"/storage/audio_cache/{audio_file}" if audio_file else None,
                    timestamp=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
        except Exception as e:
            logger.warning(f"Lỗi ghi log voice intake: {e}")

    # Nếu phát hiện yêu cầu nguy hiểm hoặc triệu chứng cấp tính -> gửi cảnh báo khẩn Telegram
    elif analysis.get("action") in ["EMERGENCY_ALERT", "REJECT_AND_NOTIFY_CAREGIVER"]:
        try:
            alert_msg = (
                f"🚨 <b>CẢNH BÁO TỪ GIỌNG NÓI NGƯỜI CAO TUỔI!</b>\n"
                f"• Nội dung bác nói: \"{req.user_speech}\"\n"
                f"• Phân loại: {analysis.get('warning_reason', 'Cảnh báo an toàn')}\n"
                f"• Phản hồi AI: {reply_text}\n"
                f"👉 <i>Đề nghị gia đình chủ động liên hệ kiểm tra tình hình sức khỏe của bác!</i>"
            )
            await send_telegram_alert(alert_msg)

            active_sch = db.query(Schedule).filter(Schedule.is_active == True).first()
            log_entry = InteractionLog(
                schedule_id=active_sch.id if active_sch else None,
                elder_id=active_sch.elder_id if active_sch else 1,
                event_type="alert",
                response_content=req.user_speech,
                notes=f"Cảnh báo giọng nói: {analysis.get('warning_reason')}",
                audio_url=f"/storage/audio_cache/{audio_file}" if audio_file else None,
                timestamp=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()
        except Exception as e:
            logger.warning(f"Lỗi gửi cảnh báo voice Telegram: {e}")

    return {
        "success": True,
        "is_safe": analysis.get("is_safe", True),
        "intent": analysis.get("intent", "GENERAL_TALK"),
        "action": analysis.get("action", "SAFE_GENERAL_REPLY"),
        "warning_reason": analysis.get("warning_reason"),
        "reply_speech": reply_text,
        "audio_url": f"/storage/audio_cache/{audio_file}" if audio_file else None
    }
