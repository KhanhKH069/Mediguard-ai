"""
Nội dung của app/models/__init__.py

Import TẤT CẢ model ở đây để:
  1. Base.metadata.create_all() nhìn thấy đủ bảng.
  2. Các relationship khai báo bằng tên chuỗi (ví dụ "Schedule") luôn tìm được class đích.
"""
from app.models.user import User, Role, caregiver_elder_link
from app.models.medication import Medication
from app.models.schedule import Schedule
from app.models.interaction_log import (
    InteractionLog,
    EventType,
    CvStatus,
    ImmutableLogError,
)
from app.models.device_event import DeviceEvent, DeviceEventName

__all__ = [
    "User",
    "Role",
    "caregiver_elder_link",
    "Medication",
    "Schedule",
    "InteractionLog",
    "EventType",
    "CvStatus",
    "ImmutableLogError",
    "DeviceEvent",
    "DeviceEventName",
]