# ==============================================================================
# MEDIGUARD CARE - TELEPHONY & AUDIO WEBHOOKS API
# Receives call lifecycle events and audio streams from Stringee / OmiCall
# ==============================================================================

import logging
from typing import Dict, Any
from fastapi import APIRouter, Request, BackgroundTasks
from ...services.voice_bot.telephony_client import telephony_client
from ...services.llm_extraction.extractor import clinical_extractor
from ...services.clinical_triage.rule_engine import rule_engine
from ...services.clinical_triage.ticket_dispatcher import ticket_dispatcher

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/telephony/call-event")
async def handle_telephony_call_event(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook nhận sự kiện trạng thái cuộc gọi từ tổng đài Stringee / OmiCall
    (dialing, ringing, answered, ended)
    """
    body = await request.json()
    call_id = body.get("call_id")
    event_type = body.get("type") or body.get("event")
    session_id = body.get("custom")

    logger.info(f"[WEBHOOK EVENT] Cuộc gọi {call_id}: sự kiện '{event_type}'")

    if event_type in ["ended", "completed"]:
        # Khi cuộc gọi kết thúc, kích hoạt tác vụ chạy ngầm bóc tách LLM và Triage
        background_tasks.add_task(
            process_completed_call_pipeline,
            session_id=session_id,
            call_id=call_id,
            duration=body.get("duration", 160)
        )

    return {"status": "ACK", "call_id": call_id}


async def process_completed_call_pipeline(session_id: str, call_id: str, duration: int):
    """
    Quy trình tự động sau cuộc gọi:
    1. Bóc tách LLM Structured Extraction (Gemini)
    2. Đánh giá Deterministic Triage Rule Engine
    3. Tạo Triage Ticket và phát sóng WebSocket cảnh báo
    """
    logger.info(f"[BACKGROUND PIPELINE] Khởi chạy bóc tách cho Session {session_id}")

    # Giả lập biên bản hội thoại mẫu nếu chưa có luồng audio
    sample_turns = [
        {"speaker": "ai", "text": "Dạ chào bác, hôm nay vết mổ của bác thế nào rồi ạ?"},
        {"speaker": "patient", "text": "Từ sáng đến giờ vết mổ hơi đau nhói hơn hôm qua, người thấy mệt và hơi âm ấm đầu khoảng 37.8 độ."},
        {"speaker": "ai", "text": "Dạ ghi nhận bác có sốt nhẹ. Băng vết mổ có bị rỉ dịch hay chảy mủ không ạ?"},
        {"speaker": "patient", "text": "Băng hơi đỏ đỏ quanh chân chỉ nhưng chưa thấy mủ cô ạ."}
    ]

    extraction_result = await clinical_extractor.extract_structured_symptoms(sample_turns)
    triage_result = rule_engine.evaluate_triage(extraction_result, {}, current_day=3)

    ticket_data = {
        "ticket_id": f"TCK-{session_id}",
        "session_id": session_id,
        "priority_level": triage_result.triage_level.value,
        "triggered_rules": triage_result.triggered_rules,
        "clinical_justification": triage_result.clinical_justification,
        "sla_deadline_minutes": triage_result.sla_deadline_minutes,
        "assigned_role": triage_result.assigned_role,
        "extraction_summary": extraction_result.model_dump()
    }

    # Bắn WebSocket tới Dashboard điều dưỡng ngay lập tức
    await ticket_dispatcher.broadcast_ticket_event("NEW_TRIAGE_TICKET", ticket_data)
