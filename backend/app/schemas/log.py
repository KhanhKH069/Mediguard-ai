from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class InteractionLogResponse(BaseModel):
    id: int
    schedule_id: Optional[int]
    elder_id: int
    event_type: str
    response_content: Optional[str]
    cv_status: Optional[str]
    device_action: Optional[str]
    confirmed_by: Optional[int]
    audio_url: Optional[str]
    notes: Optional[str]
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class CaregiverConfirmRequest(BaseModel):
    caregiver_id: int
    notes: Optional[str] = "Người nhà đã kiểm tra và xác nhận an toàn"
