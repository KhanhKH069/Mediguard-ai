from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship, validates

from app.database import Base


def _utcnow() -> datetime:
    """Giờ UTC dạng naive — giữ nguyên kiểu cột cũ, không dùng datetime.utcnow() (deprecated từ Python 3.12)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)

    # Thuốc PHẢI thuộc về một người cao tuổi cụ thể (để kiểm soát quyền truy cập và ghép lịch)
    elder_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String, nullable=False)                         # Ví dụ: "Amlodipine 5mg"
    category = Column(String, default="Thuốc điều trị")           # Ví dụ: "Thuốc Huyết Áp"

    # AN TOÀN: các trường dưới đây KHÔNG có giá trị mặc định.
    # Thiếu liều/giờ/hướng dẫn thì phải báo lỗi, không được âm thầm điền "1 viên", "Sáng"...
    dosage = Column(String, nullable=False)                       # Ví dụ: "1 viên"
    instruction = Column(String, nullable=False)                  # Ví dụ: "Uống sau khi ăn 30 phút"
    time_period = Column(String, nullable=False)                  # "Sáng", "Trưa", "Tối"

    reference_image = Column(String, nullable=True)               # Ảnh mẫu vỉ/hộp đã xác minh (đường dẫn tương đối trong storage)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    elder = relationship("User", foreign_keys=[elder_id])

    # ------------------------------------------------------------------
    # Validate / chuẩn hóa dữ liệu
    # ------------------------------------------------------------------
    @validates("name", "dosage", "instruction")
    def _validate_required_text(self, key, value):
        value = (value or "").strip()
        if not value:
            raise ValueError(f"{key} không được để trống.")
        return value

    @validates("time_period")
    def _validate_time_period(self, key, value):
        # Chuẩn hóa "sáng"/" SÁNG " -> "Sáng" để khớp với Schedule.time_period
        value = (value or "").strip().capitalize()
        if not value:
            raise ValueError("time_period không được để trống.")
        return value

    @validates("reference_image")
    def _validate_reference_image(self, key, value):
        """Thư mục /storage được phục vụ công khai, nên chặn đường dẫn thoát khỏi thư mục (path traversal)."""
        if value is None:
            return None
        value = value.strip().replace("\\", "/")
        if not value:
            return None
        if value.startswith("/") or ".." in value.split("/") or ":" in value:
            raise ValueError(f"Đường dẫn ảnh không hợp lệ: {value!r}")
        return value

    def __repr__(self) -> str:
        return f"<Medication id={self.id} elder_id={self.elder_id} {self.name!r} {self.time_period}>"