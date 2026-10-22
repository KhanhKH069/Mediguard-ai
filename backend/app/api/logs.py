from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models.interaction_log import InteractionLog
from app.models.schedule import Schedule
from app.schemas.log import InteractionLogResponse, CaregiverConfirmRequest
from app.api.websocket import broadcast_sync

router = APIRouter(prefix="/api/logs", tags=["Logs"])

@router.get("/", response_model=list[InteractionLogResponse])
def get_interaction_logs(elder_id: int = None, limit: int = 50, db: Session = Depends(get_db)):
    """
    Lấy toàn bộ nhật ký chuỗi sự kiện kiểm toán bất biến (Audit Trail).
    """
    query = db.query(InteractionLog)
    if elder_id:
        query = query.filter(InteractionLog.elder_id == elder_id)
    return query.order_by(InteractionLog.timestamp.desc()).limit(limit).all()

@router.post("/{target_id}/caregiver-confirm")
def caregiver_confirm(
    target_id: int,
    req: CaregiverConfirmRequest,
    db: Session = Depends(get_db)
):
    """
    Người chăm sóc xác nhận: 'Tôi đã kiểm tra & xác nhận an toàn'.
    Ghi nhận sự kiện 'caregiver_confirmed' độc lập vào cơ sở dữ liệu.
    Hỗ trợ target_id là schedule_id hoặc log_id.
    """
    sch = db.query(Schedule).filter(Schedule.id == target_id).first()
    if sch:
        elder_id = sch.elder_id
        schedule_id = sch.id
    else:
        log_item = db.query(InteractionLog).filter(InteractionLog.id == target_id).first()
        if log_item:
            elder_id = log_item.elder_id
            schedule_id = log_item.schedule_id
        else:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch hoặc bản ghi nhật ký phù hợp")

    log_entry = InteractionLog(
        schedule_id=schedule_id,
        elder_id=elder_id,
        event_type="caregiver_confirmed",
        confirmed_by=req.caregiver_id,
        notes=req.notes or "Người nhà đã đối chiếu và xác nhận an toàn",
        timestamp=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    broadcast_sync("caregiver_confirmed", {
        "schedule_id": schedule_id,
        "elder_id": elder_id,
        "confirmed_by": req.caregiver_id,
        "notes": log_entry.notes,
        "timestamp": log_entry.timestamp.isoformat()
    })

    return {
        "success": True,
        "event_type": "caregiver_confirmed",
        "message": "Đã ghi nhận người chăm sóc xác nhận thành công",
        "log_id": log_entry.id
    }
