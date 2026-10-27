from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CallStatus:
    SCHEDULED = "SCHEDULED"          # Đã lên lịch, chờ đến giờ
    RINGING = "RINGING"              # Đang đổ chuông máy bệnh nhân
    IN_PROGRESS = "IN_PROGRESS"      # Đang trong cuộc hội thoại
    COMPLETED = "COMPLETED"          # Bệnh nhân đã bắt máy và hoàn tất cuộc gọi
    NO_ANSWER = "NO_ANSWER"          # Bệnh nhân không nghe máy sau nhiều hồi chuông
    BUSY = "BUSY"                    # Máy bận hoặc người dùng từ chối
    FAILED = "FAILED"                # Lỗi kết nối mạng viễn thông / WebRTC


class MedicationAdherence:
    TAKEN = "TAKEN"                  # Đã uống thuốc đầy đủ
    NOT_TAKEN = "NOT_TAKEN"          # Chưa uống thuốc
    PARTIAL = "PARTIAL"              # Mới uống một phần hoặc uống sai giờ
    UNCONFIRMED = "UNCONFIRMED"      # Chưa xác nhận được (không nghe máy hoặc không rõ)


class FollowupPriority:
    CRITICAL = "CRITICAL"            # Khẩn cấp: triệu chứng nặng, uống nhầm, tức ngực, khó thở
    HIGH = "HIGH"                    # Cao: chóng mặt, nôn mửa, bệnh nhân yêu cầu hỗ trợ gấp
    MEDIUM = "MEDIUM"                # Trung bình: không nghe máy, chưa uống thuốc
    LOW = "LOW"                      # Thấp: theo dõi định kỳ
    NONE = "NONE"                    # Bình thường, an toàn


class AICallReport(Base):
    """
    Bảng lưu vết Cuộc gọi hỏi thăm tự động và Báo cáo có cấu trúc.
    Giảm tải việc nhân viên y tế phải gọi điện và nhập liệu thủ công.
    Tự động phát hiện trường hợp cần nhân viên y tế can thiệp / liên hệ lại.
    """
    __tablename__ = "ai_call_reports"
    __table_args__ = (
        Index("ix_call_reports_elder_created", "elder_id", "created_at"),
        Index("ix_call_reports_followup", "requires_followup", "handled_by_staff"),
    )

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="SET NULL"), nullable=True)

    # Thông tin cuộc gọi
    call_type = Column(String, default="TỰ ĐỘNG THEO LỊCH", nullable=False) # LỊCH ĐỊNH KỲ / ĐỘT XUẤT / HỎI THĂM SAU XUẤT VIỆN
    scheduled_time = Column(String, nullable=True)  # "08:00", "19:30"
    call_time = Column(DateTime, default=_utcnow, nullable=False, index=True)
    call_status = Column(String, default=CallStatus.COMPLETED, nullable=False)
    duration_seconds = Column(Integer, default=0, nullable=False)

    # Nội dung câu hỏi và đối thoại
    questions_asked = Column(Text, nullable=True)   # JSON danh sách câu hỏi đã duyệt
    transcript = Column(Text, nullable=True)        # JSON [ {speaker, text, timestamp} ]
    audio_url = Column(String, nullable=True)       # Link file ghi âm (nếu có)

    # 1. BÁO CÁO CÓ CẤU TRÚC DO AI TRÍCH XUẤT
    medication_adherence = Column(String, default=MedicationAdherence.UNCONFIRMED, nullable=False)
    adherence_notes = Column(Text, nullable=True)   # Ghi chú chi tiết về việc uống thuốc
    reported_symptoms = Column(Text, nullable=True) # JSON danh sách triệu chứng phát hiện
    patient_mood = Column(String, default="Bình thường", nullable=True)
    summary_report = Column(Text, nullable=False)   # Bản tóm tắt lâm sàng do AI tự động tạo

    # 2. PHÁT HIỆN TRƯỜNG HỢP CẦN NHÂN VIÊN Y TẾ LIÊN HỆ LẠI
    requires_followup = Column(Boolean, default=False, nullable=False, index=True)
    followup_reason = Column(String, nullable=True)  # Lý do: Không nghe máy, Yêu cầu hỗ trợ, Triệu chứng bất thường
    followup_priority = Column(String, default=FollowupPriority.NONE, nullable=False)

    # 3. QUY TRÌNH XỬ LÝ CỦA NHÂN VIÊN Y TẾ
    handled_by_staff = Column(Boolean, default=False, nullable=False, index=True)
    handled_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    handled_by_name = Column(String, nullable=True)
    handled_at = Column(DateTime, nullable=True)
    staff_notes = Column(Text, nullable=True)       # Ghi chú chuyên môn của nhân viên sau khi liên hệ lại

    created_at = Column(DateTime, default=_utcnow, nullable=False)

    elder = relationship("User", foreign_keys=[elder_id])
    schedule = relationship("Schedule", foreign_keys=[schedule_id])
    handler = relationship("User", foreign_keys=[handled_by_user_id])

    def __repr__(self) -> str:
        return f"<AICallReport id={self.id} elder_id={self.elder_id} status={self.call_status} followup={self.requires_followup}>"
