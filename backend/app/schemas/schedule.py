from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class ScheduleBase(BaseModel):
    time_period: str # "Sáng", "Trưa", "Tối"
    target_time: str # "07:30", "12:00", "19:00"
    is_active: bool = True
    notes: Optional[str] = None

class ScheduleCreate(ScheduleBase):
    elder_id: int
    # BẮT BUỘC phải có người chăm sóc xác minh khi tạo lịch
    verified_by: int = Field(..., description="ID người chăm sóc chịu trách nhiệm kiểm tra đơn thuốc")

class ScheduleResponse(ScheduleBase):
    id: int
    elder_id: int
    verified_by: int
    verified_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ElderRespondRequest(BaseModel):
    """
    3 nút bấm an toàn của người cao tuổi:
    - 'HEARD' (Đã nghe nhắc / Đã uống xong)
    - 'UNSURE' (Chưa chắc chắn / Thuốc nhìn lạ)
    - 'HELP' (Cần người nhà giúp đỡ gấp)
    """
    response_type: str = Field(..., description="HEARD | UNSURE | HELP")
    speech_text: Optional[str] = None
