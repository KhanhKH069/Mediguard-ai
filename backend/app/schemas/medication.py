from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class MedicationBase(BaseModel):
    name: str
    category: str = "Thuốc điều trị"
    dosage: str = "1 viên"
    instruction: str = "Uống sau khi ăn 30 phút"
    time_period: str = "Sáng"
    reference_image: Optional[str] = None
    is_active: bool = True

class MedicationCreate(MedicationBase):
    elder_id: Optional[int] = None

class MedicationResponse(MedicationBase):
    id: int
    elder_id: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
