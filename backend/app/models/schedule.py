import re
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship, validates

from app.database import Base

_TIME_RE = re.compile(r"^\s*(\d{1,2})\s*[:hH.]\s*(\d{2})\s*$")


def _utcnow() -> datetime:
    """Giờ UTC dạng naive — giữ nguyên kiểu cột cũ, không dùng datetime.utcnow() (deprecated từ Python 3.12)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Schedule(Base):
    __tablename__ = "schedules"
    __table_args__ = (
        # Mỗi người cao tuổi chỉ có 1 lịch cho mỗi buổi -> tránh nhắc thuốc 2 lần.
        # LƯU Ý: create_all() không thêm ràng buộc này vào bảng đã tồn tại.
        UniqueConstraint("elder_id", "time_period", name="uq_schedule_elder_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    time_period = Column(String, nullable=False)        # "Sáng", "Trưa", "Tối"
    target_time = Column(String, nullable=False)        # "07:30", "12:00", "19:00" (HH:MM, 24h)
    is_active = Column(Boolean, default=True, nullable=False)

    # BẮT BUỘC có người chăm sóc xác minh & thời điểm xác minh
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    verified_at = Column(DateTime, default=_utcnow, nullable=False)
    notes = Column(String, nullable=True)               # Ghi chú đã đối chiếu theo đơn thuốc của bác sĩ

    # Ảnh mẫu ngăn thuốc do con cái chụp khi chia thuốc & vị trí ngăn
    reference_image = Column(String, nullable=True)     # Ảnh mẫu ngăn thuốc (Baseline) do con cái chụp
    compartment_number = Column(Integer, default=1, nullable=True) # Số ngăn thuốc trên khay (1, 2, 3...)

    elder = relationship("User", foreign_keys=[elder_id])
    verifier = relationship("User", foreign_keys=[verified_by])

    # ------------------------------------------------------------------
    # Validate dữ liệu
    # ------------------------------------------------------------------
    @validates("time_period")
    def _validate_time_period(self, key, value):
        # Chuẩn hóa "sáng"/" SÁNG " -> "Sáng" để khớp với Medication.time_period
        value = (value or "").strip().capitalize()
        if not value:
            raise ValueError("time_period không được để trống.")
        return value

    @validates("target_time")
    def _validate_target_time(self, key, value):
        """Chấp nhận '7:30', '07:30', '7h30' và chuẩn hóa về 'HH:MM'. Từ chối '25:99', 'abc'..."""
        m = _TIME_RE.match(value or "")
        if not m:
            raise ValueError(f"target_time phải có dạng HH:MM (24 giờ), nhận được: {value!r}")
        hour, minute = int(m.group(1)), int(m.group(2))
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError(f"target_time ngoài phạm vi hợp lệ: {value!r}")
        return f"{hour:02d}:{minute:02d}"

    # ------------------------------------------------------------------
    # Xác minh lịch
    # ------------------------------------------------------------------
    def mark_verified(self, caregiver, notes: str | None = None) -> None:
        """
        Ghi nhận người chăm sóc đã xác minh lịch này (kèm thời điểm hiện tại).
        Chỉ người chăm sóc đang hoạt động và được gán cho người cao tuổi này mới được xác minh;
        chính người cao tuổi không thể tự xác minh lịch của mình.

        Nên gọi hàm này mỗi khi tạo lịch HOẶC sửa time_period/target_time,
        vì lịch đã đổi nội dung thì xác minh cũ không còn đúng nữa.
        """
        if caregiver.id == self.elder_id or not caregiver.can_access_elder(self.elder_id):
            raise PermissionError("Chỉ người chăm sóc được gán cho người cao tuổi này mới được xác minh lịch.")
        self.verified_by = caregiver.id
        self.verified_at = _utcnow()
        if notes is not None:
            self.notes = notes

    def __repr__(self) -> str:
        return f"<Schedule id={self.id} elder_id={self.elder_id} {self.time_period} {self.target_time}>"