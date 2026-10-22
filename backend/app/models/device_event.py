from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint, Index
)
from sqlalchemy.orm import relationship, validates

from app.database import Base

MAX_RAW_PAYLOAD_CHARS = 8192


def _utcnow() -> datetime:
    """Giờ UTC dạng naive — giữ nguyên kiểu cột cũ, không dùng datetime.utcnow() (deprecated từ Python 3.12)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DeviceEventName:
    """Các sự kiện mà firmware ESP32 được phép gửi lên. Thêm tên mới ở đây khi firmware có thêm sự kiện."""
    COMPARTMENT_OPENED = "COMPARTMENT_OPENED"
    BUTTON_PRESSED = "BUTTON_PRESSED"
    WEIGHT_CHANGED = "WEIGHT_CHANGED"

    ALL = {COMPARTMENT_OPENED, BUTTON_PRESSED, WEIGHT_CHANGED}


class DeviceEvent(Base):
    """
    Sự kiện vật lý ghi nhận từ hộp thuốc thông minh ESP32 / Cảm biến (MVP 3).
    Dữ liệu cảm biến KHÔNG được tự ý đánh đồng với việc người dùng đã uống thuốc.
    (Mở ngăn thuốc không có nghĩa là đã uống; chỉ người chăm sóc xác nhận hoặc
    người cao tuổi phản hồi mới được ghi vào InteractionLog như bằng chứng uống thuốc.)
    """
    __tablename__ = "device_events"
    __table_args__ = (
        CheckConstraint(
            "compartment_index IS NULL OR compartment_index >= 1",
            name="ck_device_event_compartment_positive",
        ),
        Index("ix_device_events_elder_created", "elder_id", "created_at"),
        Index("ix_device_events_device_created", "device_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, nullable=False, index=True)  # Ví dụ: "ESP32-BOX-001"
    elder_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    event_name = Column(String, nullable=False)             # Xem class DeviceEventName
    compartment_index = Column(Integer, nullable=True)      # Ngăn số 1 (Sáng), 2 (Trưa), 3 (Tối)
    raw_payload = Column(Text, nullable=True)               # Dữ liệu thô thiết bị gửi (JSON/chuỗi)

    # Giờ do THIẾT BỊ báo (có thể trễ nếu thiết bị mất mạng rồi gửi bù). Có thể rỗng nếu thiết bị không có đồng hồ.
    occurred_at = Column(DateTime, nullable=True)
    # Giờ SERVER nhận được sự kiện — đáng tin cậy hơn, dùng để sắp xếp và đối chiếu.
    created_at = Column(DateTime, default=_utcnow, nullable=False, index=True)

    elder = relationship("User", foreign_keys=[elder_id])

    # ------------------------------------------------------------------
    # Validate dữ liệu
    # ------------------------------------------------------------------
    @validates("device_id")
    def _validate_device_id(self, key, value):
        value = (value or "").strip()
        if not value:
            raise ValueError("device_id không được để trống.")
        return value

    @validates("event_name")
    def _validate_event_name(self, key, value):
        value = (value or "").strip().upper()
        if value not in DeviceEventName.ALL:
            raise ValueError(f"event_name không hợp lệ: {value!r}. Chỉ chấp nhận: {sorted(DeviceEventName.ALL)}")
        return value

    @validates("compartment_index")
    def _validate_compartment_index(self, key, value):
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ValueError(f"compartment_index phải là số nguyên >= 1, nhận được: {value!r}")
        return value

    @validates("raw_payload")
    def _validate_raw_payload(self, key, value):
        # Giới hạn kích thước để một thiết bị lỗi/giả mạo không làm đầy database
        if value is not None and len(value) > MAX_RAW_PAYLOAD_CHARS:
            raise ValueError(f"raw_payload quá dài (tối đa {MAX_RAW_PAYLOAD_CHARS} ký tự).")
        return value

    def __repr__(self) -> str:
        return f"<DeviceEvent id={self.id} device={self.device_id} elder_id={self.elder_id} {self.event_name}>"