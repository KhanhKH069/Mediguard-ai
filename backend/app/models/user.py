from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship, validates, object_session

from app.database import Base


class Role:
    """Các vai trò hợp lệ trong hệ thống."""
    ELDER = "ELDER"          # Người cao tuổi
    CAREGIVER = "CAREGIVER"  # Người chăm sóc

    ALL = {ELDER, CAREGIVER}


def _utcnow() -> datetime:
    """Giờ UTC dạng naive (không tzinfo) — giữ nguyên kiểu cột cũ, không cần migration,
    và không dùng datetime.utcnow() vốn đã bị deprecated từ Python 3.12."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# Bảng liên kết nhiều-nhiều giữa Người chăm sóc và Người cao tuổi
caregiver_elder_link = Table(
    "caregiver_elder_link",
    Base.metadata,
    Column("caregiver_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("elder_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Phân quyền vai trò: "ELDER" (Người cao tuổi) hoặc "CAREGIVER" (Người chăm sóc)
    role = Column(String, default=Role.CAREGIVER, nullable=False)
    phone_number = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # Danh sách người cao tuổi mà người chăm sóc này quản lý
    assigned_elders = relationship(
        "User",
        secondary=caregiver_elder_link,
        primaryjoin=lambda: User.id == caregiver_elder_link.c.caregiver_id,
        secondaryjoin=lambda: User.id == caregiver_elder_link.c.elder_id,
        back_populates="caregivers",
    )

    # Chiều ngược lại: những người chăm sóc đang quản lý người cao tuổi này
    caregivers = relationship(
        "User",
        secondary=caregiver_elder_link,
        primaryjoin=lambda: User.id == caregiver_elder_link.c.elder_id,
        secondaryjoin=lambda: User.id == caregiver_elder_link.c.caregiver_id,
        back_populates="assigned_elders",
    )

    # ------------------------------------------------------------------
    # Validate dữ liệu
    # ------------------------------------------------------------------
    @validates("role")
    def _validate_role(self, key, value):
        value = (value or "").strip().upper()
        if value not in Role.ALL:
            raise ValueError(f"Vai trò không hợp lệ: {value!r}. Chỉ chấp nhận: {sorted(Role.ALL)}")
        return value

    @validates("assigned_elders")
    def _validate_assigned_elder(self, key, elder):
        # role chưa gán thì SQLAlchemy sẽ dùng mặc định CAREGIVER
        if (self.role or Role.CAREGIVER) != Role.CAREGIVER:
            raise ValueError("Chỉ tài khoản CAREGIVER mới được gán người cao tuổi để quản lý.")
        if (elder.role or Role.CAREGIVER) != Role.ELDER:
            raise ValueError("Chỉ có thể liên kết với tài khoản có vai trò ELDER.")
        return elder

    # ------------------------------------------------------------------
    # Phân quyền
    # ------------------------------------------------------------------
    def can_access_elder(self, elder_id: int) -> bool:
        """
        Kiểm tra người dùng hiện tại có quyền truy cập dữ liệu của elder_id không.
        - Tài khoản bị khóa (is_active = False): không có quyền gì.
        - ELDER: chỉ được truy cập chính mình.
        - CAREGIVER: chỉ được truy cập người cao tuổi trong danh sách được gán.
        - Vai trò khác/không xác định: từ chối (fail-closed).
        """
        if not self.is_active:
            return False

        if self.role == Role.ELDER:
            return self.id == elder_id

        if self.role == Role.CAREGIVER:
            session = object_session(self)
            if session is not None:
                # Truy vấn trực tiếp, không phải tải cả danh sách người cao tuổi lên bộ nhớ
                return (
                    session.query(caregiver_elder_link.c.elder_id)
                    .filter(
                        caregiver_elder_link.c.caregiver_id == self.id,
                        caregiver_elder_link.c.elder_id == elder_id,
                    )
                    .first()
                    is not None
                )
            return any(e.id == elder_id for e in self.assigned_elders)

        return False

    def __repr__(self) -> str:
        # Cố ý không in hashed_password
        return f"<User id={self.id} username={self.username!r} role={self.role}>"