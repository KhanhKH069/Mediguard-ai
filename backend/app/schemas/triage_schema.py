# ==============================================================================
# MEDIGUARD CARE - CLINICAL TRIAGE SCHEMAS
# Input / Output data contracts for Triage Decision & Closed-Loop Resolution
# ==============================================================================

from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TriageLevel(str, Enum):
    RED = "RED"          # Báo động đỏ cấp cứu (< 15 phút)
    ORANGE = "ORANGE"    # Cần nhân viên y tế xem xét (< 4 giờ)
    YELLOW = "YELLOW"    # Cần bổ sung thông tin hoặc giải đáp (< 12 giờ)
    GREEN = "GREEN"      # Tiến triển phục hồi tốt theo kế hoạch (Routine)


class TicketStatus(str, Enum):
    OPEN = "OPEN"                      # Mới tiếp nhận từ AI Call
    ACKNOWLEDGED = "ACKNOWLEDGED"      # Nhân viên y tế đã nhận ca
    IN_PROGRESS = "IN_PROGRESS"        # Đang gọi lại / đang xử lý
    RESOLVED = "RESOLVED"              # Đã xử lý xong và đóng ca an toàn
    ESCALATED = "ESCALATED"            # Đã chuyển viện / chuyển khoa Cấp cứu


class TriageEvaluationResult(BaseModel):
    triage_level: TriageLevel
    triggered_rules: List[str] = Field(
        ...,
        description="Danh sách các điều kiện nghiệp vụ y tế đã kích hoạt mức này"
    )
    clinical_justification: str = Field(
        ...,
        description="Giải thích lâm sàng chi tiết cho bác sĩ và điều dưỡng"
    )
    sla_deadline_minutes: int = Field(
        ...,
        description="Thời hạn tối đa nhân viên y tế phải xử lý (phút)"
    )
    assigned_role: str = Field(
        default="Điều dưỡng theo dõi",
        description="Nhóm nhân sự chịu trách nhiệm xử lý (Bác sĩ cấp cứu, Bác sĩ mổ, Điều dưỡng)"
    )
    recommended_actions: List[str] = Field(
        default_factory=list,
        description="Các bước hành động khuyến nghị theo quy trình chuẩn"
    )


class TriageTicketCreate(BaseModel):
    patient_id: str
    call_session_id: str
    priority_level: TriageLevel
    triggered_rules: List[str]
    clinical_summary: str
    sla_deadline: datetime
    assigned_to_user_id: Optional[str] = None


class ActionResolutionRequest(BaseModel):
    action_type: str = Field(
        ...,
        description="call_patient, adjust_meds, schedule_early, code_red, resolve_safe"
    )
    staff_user_id: str
    staff_name: str
    resolution_notes: str = Field(
        ...,
        min_length=5,
        description="Ghi chú lâm sàng bắt buộc ghi lại kết quả xử lý của nhân viên y tế"
    )


class TriageTicketResponse(BaseModel):
    ticket_id: str
    patient_id: str
    patient_name: str
    patient_phone: str
    procedure: str
    discharge_day: str
    priority_level: TriageLevel
    status: TicketStatus
    triggered_rules: List[str]
    clinical_summary: str
    evidence_quotes: List[str]
    sla_deadline: datetime
    sla_remaining_minutes: int
    assigned_to: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
