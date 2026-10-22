from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text,
    CheckConstraint, Index, DDL, event,
)
from sqlalchemy.orm import relationship, validates

from app.database import Base


def _utcnow() -> datetime:
    """Giờ UTC dạng naive — giữ nguyên kiểu cột cũ, không dùng datetime.utcnow() (deprecated từ Python 3.12)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EventType:
    REMINDER_SENT = "reminder_sent"              # Hệ thống phát thông báo nhắc nhở đến giờ
    USER_RESPONDED = "user_responded"            # Người cao tuổi phản hồi ("Đã nghe" / "Chưa chắc" / "Cần giúp")
    DEVICE_RECORDED = "device_recorded"          # Camera/cảm biến ghi nhận hành động với vỉ thuốc
    CAREGIVER_CONFIRMED = "caregiver_confirmed"  # Người thân đã kiểm tra và bấm xác nhận
    ALERT = "alert"                              # Cảnh báo quá hạn hoặc nguy cơ an toàn

    ALL = {REMINDER_SENT, USER_RESPONDED, DEVICE_RECORDED, CAREGIVER_CONFIRMED, ALERT}


class CvStatus:
    NONE = "NONE"
    MATCHED = "MATCHED"
    MISMATCH = "MISMATCH"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"

    ALL = {NONE, MATCHED, MISMATCH, LOW_CONFIDENCE}


class ImmutableLogError(RuntimeError):
    """Ném ra khi có mã cố sửa hoặc xóa một dòng nhật ký."""


class InteractionLog(Base):
    """
    Mô hình lưu vết BẤT BIẾN theo Chuỗi sự kiện (Event-Sourcing Audit Log).
    Mỗi khi có hành động xảy ra, một dòng mới được ghi vào cơ sở dữ liệu,
    TUYỆT ĐỐI KHÔNG GHI ĐÈ để bảo toàn tính toàn vẹn y tế và pháp lý.

    Tính bất biến được ép buộc ở 2 tầng (xem cuối file):
      1. ORM: sửa/xóa qua session sẽ ném ImmutableLogError.
      2. Database (SQLite): trigger chặn mọi UPDATE/DELETE, kể cả query.update()/delete() hàng loạt.
    """
    __tablename__ = "interaction_logs"
    __table_args__ = (
        # Xác nhận của người thân thì bắt buộc phải biết ai xác nhận
        CheckConstraint(
            "event_type != 'caregiver_confirmed' OR confirmed_by IS NOT NULL",
            name="ck_log_confirmed_by_required",
        ),
        # Truy vấn dòng thời gian của một người cao tuổi
        Index("ix_logs_elder_timestamp", "elder_id", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True)
    elder_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Loại sự kiện — xem class EventType
    event_type = Column(String, nullable=False, index=True)

    # Chi tiết nội dung sự kiện
    response_content = Column(String, nullable=True)     # "Đã nghe nhắc", "Chưa chắc chắn", "Cần giúp"
    cv_status = Column(String, default=CvStatus.NONE, nullable=False)   # NONE, MATCHED, MISMATCH, LOW_CONFIDENCE
    device_action = Column(String, nullable=True)        # "BUTTON_CLICK", "CAMERA_SCAN", "SENSOR_OPEN"
    confirmed_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # ID người chăm sóc nếu là confirm
    audio_url = Column(String, nullable=True)            # File audio TTS đọc tên thuốc đã phát
    notes = Column(Text, nullable=True)                  # Ghi chú / cảnh báo
    timestamp = Column(DateTime, default=_utcnow, nullable=False, index=True)

    schedule = relationship("Schedule", foreign_keys=[schedule_id])
    elder = relationship("User", foreign_keys=[elder_id])
    confirmer = relationship("User", foreign_keys=[confirmed_by])

    # ------------------------------------------------------------------
    # Validate dữ liệu
    # ------------------------------------------------------------------
    @validates("event_type")
    def _validate_event_type(self, key, value):
        value = (value or "").strip().lower()
        if value not in EventType.ALL:
            raise ValueError(f"event_type không hợp lệ: {value!r}. Chỉ chấp nhận: {sorted(EventType.ALL)}")
        return value

    @validates("cv_status")
    def _validate_cv_status(self, key, value):
        value = (value or CvStatus.NONE).strip().upper()
        if value not in CvStatus.ALL:
            raise ValueError(f"cv_status không hợp lệ: {value!r}. Chỉ chấp nhận: {sorted(CvStatus.ALL)}")
        return value

    def __repr__(self) -> str:
        return f"<InteractionLog id={self.id} elder_id={self.elder_id} {self.event_type} {self.timestamp}>"


# ----------------------------------------------------------------------
# Tầng 1: chặn sửa/xóa qua ORM
# ----------------------------------------------------------------------
@event.listens_for(InteractionLog, "before_update")
def _block_update(mapper, connection, target):
    raise ImmutableLogError("InteractionLog là nhật ký chỉ-ghi: không được sửa. Hãy ghi thêm một dòng sự kiện mới.")


@event.listens_for(InteractionLog, "before_delete")
def _block_delete(mapper, connection, target):
    raise ImmutableLogError("InteractionLog là nhật ký chỉ-ghi: không được xóa.")


# ----------------------------------------------------------------------
# Tầng 2: trigger ở database (SQLite). Chặn cả query.update()/delete() hàng loạt
# vốn không đi qua event của ORM. Với PostgreSQL/MySQL cần tạo trigger tương đương bằng migration.
# ----------------------------------------------------------------------
_TRIGGER_NO_UPDATE = DDL(
    "CREATE TRIGGER IF NOT EXISTS trg_interaction_logs_no_update "
    "BEFORE UPDATE ON interaction_logs "
    "BEGIN SELECT RAISE(ABORT, 'interaction_logs chỉ được ghi thêm, không được sửa'); END;"
).execute_if(dialect="sqlite")

_TRIGGER_NO_DELETE = DDL(
    "CREATE TRIGGER IF NOT EXISTS trg_interaction_logs_no_delete "
    "BEFORE DELETE ON interaction_logs "
    "BEGIN SELECT RAISE(ABORT, 'interaction_logs chỉ được ghi thêm, không được xóa'); END;"
).execute_if(dialect="sqlite")

event.listen(InteractionLog.__table__, "after_create", _TRIGGER_NO_UPDATE)
event.listen(InteractionLog.__table__, "after_create", _TRIGGER_NO_DELETE)