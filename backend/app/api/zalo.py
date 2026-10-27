from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.core.zalo_service import zalo_service, ZALO_OA_ID, ZALO_APP_ID

router = APIRouter(prefix="/api/zalo", tags=["Zalo OA & Mini App"])


class SendZaloReportRequest(BaseModel):
    elder_name: str = Field(default="Bác Nguyễn Văn Ba (72 tuổi)")
    elder_id: int = Field(default=1)
    schedule_id: Optional[int] = Field(default=None)
    time_period: str = Field(default="Sáng")
    target_time: str = Field(default="07:30")
    medications: List[str] = Field(default_factory=lambda: ["Amlodipine 5mg", "Ginkgo Biloba 120mg"])
    captured_image_url: Optional[str] = None
    reference_image_url: Optional[str] = None
    cv_status: str = Field(default="MATCHED")
    confidence_score: float = Field(default=0.94)
    elder_speech: Optional[str] = Field(default="Dạ, Bác đã uống xong thuốc rồi con nhé!")
    notes: Optional[str] = None
    recipient_phone: Optional[str] = Field(default="0987654321")
    recipient_name: Optional[str] = Field(default="Nguyễn Văn Nam (Con trai)")


@router.get("/messages")
def get_zalo_messages(elder_id: Optional[int] = Query(None), limit: int = Query(50)):
    """
    Lấy danh sách tin nhắn Zalo OA gửi đến con cái kèm ảnh chụp ngăn thuốc.
    """
    return zalo_service.get_messages(elder_id=elder_id, limit=limit)


@router.post("/send-report")
async def send_zalo_report(req: SendZaloReportRequest):
    """
    Gửi báo cáo cữ thuốc và ảnh chụp ngăn thuốc thẳng qua tin nhắn Zalo của con cái.
    Được gọi tự động khi camera trên giá đỡ chụp và phân tích thành công.
    """
    msg = await zalo_service.send_pill_report(
        elder_name=req.elder_name,
        elder_id=req.elder_id,
        schedule_id=req.schedule_id,
        time_period=req.time_period,
        target_time=req.target_time,
        medications=req.medications,
        captured_image_url=req.captured_image_url,
        reference_image_url=req.reference_image_url,
        cv_status=req.cv_status,
        confidence_score=req.confidence_score,
        elder_speech=req.elder_speech,
        notes=req.notes,
        recipient_phone=req.recipient_phone,
        recipient_name=req.recipient_name,
    )
    return {"success": True, "message": msg}


@router.post("/confirm-message/{message_id}")
async def confirm_zalo_message(message_id: str, caregiver_name: str = Body("Nguyễn Văn Nam", embed=True)):
    """
    Xử lý nút bấm 'Xác nhận an tâm' của con cái ngay trên giao diện tin nhắn Zalo OA.
    """
    success = await zalo_service.confirm_message(message_id, caregiver_name=caregiver_name)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy tin nhắn Zalo tương ứng")
    return {"success": True, "message_id": message_id}


@router.get("/config")
def get_zalo_config():
    """
    Trả về cấu hình Zalo Mini App và Zalo Official Account ở giai đoạn MVP.
    """
    return {
        "zalo_oa_id": ZALO_OA_ID,
        "zalo_app_id": ZALO_APP_ID,
        "oa_name": "MediGuard AI - Chăm Sóc Cha Mẹ",
        "oa_verified": True,
        "status": "active",
        "description": "Tài khoản Zalo OA chính thức kết nối giám sát khay thuốc người cao tuổi.",
        "features": [
            "Gửi ảnh chụp ngăn thuốc thẳng qua tin nhắn Zalo",
            "Mô phỏng Zalo Mini App dành cho con cái quản lý chia thuốc",
            "Nút xác nhận an tâm 1-chạm (Zero Latency)"
        ]
    }


@router.post("/webhook")
async def zalo_webhook(payload: Dict[str, Any] = Body(...)):
    """
    Tiếp nhận Webhook từ Zalo OA khi người dùng nhắn tin hoặc bấm nút tương tác trên Zalo.
    """
    return {"error": 0, "message": "Success", "received": payload}
