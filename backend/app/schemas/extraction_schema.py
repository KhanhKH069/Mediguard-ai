# ==============================================================================
# MEDIGUARD CARE - EXTRACTION SCHEMA (ZERO-HALLUCINATION ENFORCEMENT)
# Pydantic v2 + Structured Output Constraints
# ==============================================================================

from enum import Enum
from typing import List, Optional, Any
from pydantic import BaseModel, Field


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNCLEAR = "UNCLEAR"  # Mandatory fallback when patient is ambiguous


class SourceType(str, Enum):
    PATIENT_SELF_REPORT = "PATIENT_SELF_REPORT"  # Bệnh nhân tự trả lời
    CAREGIVER_PROXY = "CAREGIVER_PROXY"          # Người nhà/chăm sóc trả lời thay


class EvolutionTrend(str, Enum):
    IMPROVING = "IMPROVING"       # Thuyên giảm (đỡ nhiều, êm hơn)
    STABLE = "STABLE"             # Ổn định (như cũ, không đổi)
    WORSENING = "WORSENING"       # Tăng nặng (đau tăng, nhức dữ hơn)
    NEW_ONSET = "NEW_ONSET"       # Mới xuất hiện từ hôm nay
    UNCLEAR = "UNCLEAR"           # Không rõ ràng


class WoundExudate(str, Enum):
    DRY = "DRY"                               # Khô ráo, không dịch
    SEROUS = "SEROUS"                         # Dịch trong / huyết thanh nhẹ
    YELLOW_PUS = "YELLOW_PUS"                 # Dịch mủ vàng / đục
    FRESH_BLOOD = "FRESH_BLOOD"               # Rỉ máu đỏ tươi
    SOAKED_DRESSING = "SOAKED_DRESSING"       # Ướt đẫm băng gạc
    FOUL_SMELL = "FOUL_SMELL"                 # Có mùi hôi
    UNCLEAR = "UNCLEAR"                       # Bệnh nhân chưa tháo băng xem / không rõ


class SymptomField(BaseModel):
    """
    Trường triệu chứng bắt buộc kèm trích dẫn nguyên văn (evidence_quote)
    để ngăn chặn triệt để hiện tượng LLM Hallucination (tự bịa triệu chứng).
    """
    value: Any = Field(
        ...,
        description="Giá trị đã chuẩn hóa của triệu chứng (hoặc UNCLEAR nếu không rõ)"
    )
    confidence: ConfidenceLevel = Field(
        default=ConfidenceLevel.HIGH,
        description="Độ tin cậy của thông tin bóc tách"
    )
    evidence_quote: str = Field(
        ...,
        description="TRÍCH DẪN NGUYÊN VĂN câu nói của bệnh nhân/người nhà trong đoạn ghi âm để đối chiếu"
    )
    source_type: SourceType = Field(
        default=SourceType.PATIENT_SELF_REPORT,
        description="Ai là người cung cấp thông tin trong cuộc gọi"
    )


class PostOpExtractionResult(BaseModel):
    """
    Cấu trúc dữ liệu đầu ra toàn diện của một phiên gọi theo dõi sau xuất viện
    """
    patient_verified: bool = Field(
        ...,
        description="Đã xác minh đúng danh tính người bệnh hay chưa"
    )
    respondent_name: Optional[str] = Field(
        default=None,
        description="Tên người nghe máy nếu là người nhà trả lời thay"
    )

    # Đau & Diễn tiến
    pain_status: SymptomField = Field(
        ...,
        description="Tình trạng đau vết mổ hiện tại (nhẹ, vừa, nặng, hết đau)"
    )
    pain_trend: SymptomField = Field(
        ...,
        description="Diễn tiến so với ngày trước (IMPROVING, STABLE, WORSENING, UNCLEAR)"
    )
    pain_vas: Optional[int] = Field(
        default=None,
        ge=0,
        le=10,
        description="Thang điểm đau từ 0 đến 10 theo bệnh nhân tự chấm"
    )

    # Vết mổ & Dịch
    wound_condition: SymptomField = Field(
        ...,
        description="Tình trạng vết mổ thành bụng hoặc vết rạch"
    )
    wound_exudate: SymptomField = Field(
        ...,
        description="Tính chất dịch thấm băng gạc (DRY, YELLOW_PUS, FRESH_BLOOD, v.v.)"
    )

    # Thân nhiệt & Sốt
    fever_status: SymptomField = Field(
        ...,
        description="Trạng thái sốt (không sốt, sốt nhẹ, sốt cao kèm ớn lạnh)"
    )
    temperature_celsius: Optional[float] = Field(
        default=None,
        description="Nhiệt độ đo được bằng nhiệt kế (°C), null nếu chưa đo"
    )

    # Tiêu hóa / Hô hấp / Toàn thân
    gi_tolerance: Optional[SymptomField] = Field(
        default=None,
        description="Dung nạp thức ăn loãng, chướng bụng, buồn nôn, đại tiện"
    )
    breathing_difficulty: bool = Field(
        default=False,
        description="Có dấu hiệu khó thở cấp tính hoặc thở dốc không"
    )

    # Tuân thủ đơn thuốc & Vận động
    medication_adherence: SymptomField = Field(
        ...,
        description="Tuân thủ uống thuốc kháng sinh / giảm đau theo đơn ra viện"
    )
    mobility_status: Optional[SymptomField] = Field(
        default=None,
        description="Khả năng tự ngồi dậy và đi lại nhẹ nhàng trong phòng"
    )

    # Câu hỏi cần giải đáp & Cảnh báo tức thời
    patient_questions: List[str] = Field(
        default_factory=list,
        description="Các câu hỏi hoặc thắc mắc của bệnh nhân cần điều dưỡng giải đáp"
    )
    has_unclear_fields: bool = Field(
        default=False,
        description="Đánh dấu True nếu có bất kỳ trường thiết yếu nào chưa rõ ràng"
    )
    immediate_escalation_needed: bool = Field(
        default=False,
        description="Cần nối máy khẩn cấp tới bác sĩ hoặc chuyển viện cấp cứu ngay"
    )
