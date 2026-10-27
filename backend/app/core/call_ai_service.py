"""
MediGuard AI - Call AI Service (Tổng đài AI Hỏi thăm bệnh nhân & Báo cáo tự động)
Tuân thủ nguyên tắc an toàn: AI không tự chẩn đoán hay thay đổi đơn thuốc.
Nhiệm vụ của AI:
1. Thực hiện kịch bản gọi hỏi thăm bằng giọng đọc tự nhiên theo bộ câu hỏi đã duyệt.
2. Tự động chuyển nội dung cuộc thoại thành bản ghi có cấu trúc (Structured Report).
3. Phát hiện chính xác các trường hợp cần nhân viên y tế liên hệ lại (Không nghe máy, Xin hỗ trợ, Triệu chứng bất thường).
"""

import re
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Tuple

from app.models.call_report import (
    CallStatus,
    MedicationAdherence,
    FollowupPriority,
)

logger = logging.getLogger(__name__)

# BỘ CÂU HỎI LÂM SÀNG ĐÃ ĐƯỢC DUYỆT (APPROVED CLINICAL QUESTION SET)
DEFAULT_APPROVED_QUESTIONS = [
    {
        "id": "q1_adherence",
        "category": "Tuân thủ dùng thuốc",
        "question": "Kính chào Bác! Cháu là Trợ lý Y tế AI gọi thăm sức khỏe Bác theo lịch. Cữ thuốc của Bác, Bác đã uống đầy đủ chưa ạ?",
        "short_label": "Hỏi cữ thuốc",
        "is_active": True,
        "required": True,
    },
    {
        "id": "q2_general_status",
        "category": "Thể trạng chung",
        "question": "Dạ, Bác cảm thấy trong người hôm nay thế nào ạ? Bác có ăn uống và nghỉ ngơi được không ạ?",
        "short_label": "Hỏi thể trạng",
        "is_active": True,
        "required": True,
    },
    {
        "id": "q3_side_effects",
        "category": "Triệu chứng & Tác dụng phụ",
        "question": "Bác có cảm thấy khó chịu hay triệu chứng bất thường nào như chóng mặt, đau đầu, buồn nôn hay tức ngực không ạ?",
        "short_label": "Khảo sát triệu chứng",
        "is_active": True,
        "required": True,
    },
    {
        "id": "q4_assistance",
        "category": "Yêu cầu hỗ trợ",
        "question": "Bác có cần nhân viên y tế hoặc người nhà liên hệ lại để hỗ trợ thêm điều gì không ạ?",
        "short_label": "Nhu cầu hỗ trợ",
        "is_active": True,
        "required": True,
    },
]

# Từ khóa nhận diện hành vi tuân thủ uống thuốc
ADHERENCE_POSITIVE = [
    "đã uống", "uống rồi", "vừa uống xong", "uống hết rồi", "uống đủ rồi",
    "đã dùng", "uống từ sớm", "uống xong rồi", "rồi ạ", "uống rồi con",
    "uống đầy đủ", "bác uống rồi", "uống xong"
]

ADHERENCE_NEGATIVE = [
    "chưa uống", "quên mất", "chưa kịp", "chưa uống đâu", "quên uống",
    "không muốn uống", "chưa uống được", "chưa bác chưa uống", "chưa con à",
    "đang bận chưa uống", "không có thuốc", "hết thuốc"
]

# Từ khóa triệu chứng và mức độ nghiêm trọng
CLINICAL_SYMPTOMS_MAP = [
    ("tức ngực", "Tức ngực, đau thắt ngực", FollowupPriority.CRITICAL),
    ("khó thở", "Khó thở, hụt hơi", FollowupPriority.CRITICAL),
    ("uống nhầm", "Nghi ngờ uống nhầm thuốc", FollowupPriority.CRITICAL),
    ("ngất", "Choáng váng ngất xỉu", FollowupPriority.CRITICAL),
    ("chóng mặt", "Chóng mặt, choáng váng", FollowupPriority.HIGH),
    ("buồn nôn", "Buồn nôn, nôn ói", FollowupPriority.HIGH),
    ("đau đầu", "Đau đầu, nhức đầu", FollowupPriority.HIGH),
    ("đau bụng", "Đau bụng quặn, cồn cào", FollowupPriority.HIGH),
    ("mệt mỏi", "Mệt mỏi, kiệt sức", FollowupPriority.HIGH),
    ("mệt quá", "Rất mệt trong người", FollowupPriority.HIGH),
    ("sốt", "Người nóng sốt", FollowupPriority.HIGH),
    ("tim đập nhanh", "Hồi hộp, tim đập nhanh", FollowupPriority.HIGH),
    ("run tay", "Run tay chân, bủn rủn", FollowupPriority.MEDIUM),
    ("ngứa", "Mẩn ngứa, dị ứng da", FollowupPriority.MEDIUM),
    ("mất ngủ", "Khó ngủ, mất ngủ", FollowupPriority.LOW),
]

# Từ khóa yêu cầu nhân viên y tế liên hệ lại
ASSISTANCE_REQUEST_KEYWORDS = [
    "cần bác sĩ", "nhờ bác sĩ", "nhờ y tá", "cần người giúp",
    "gọi lại cho tôi", "liên hệ lại", "nhờ con tôi", "cần hỏi",
    "tư vấn giúp", "đau quá", "lo lắng", "không hiểu", "giúp bác với",
    "có cần", "gọi lại nhé", "liên hệ giúp"
]


def analyze_transcript_and_generate_report(
    elder_name: str,
    elder_phone: str,
    call_status: str,
    duration_seconds: int,
    transcript: List[Dict[str, Any]],
    scheduled_time: str = None,
    schedule_details: str = None,
) -> Dict[str, Any]:
    """
    Phân tích nội dung cuộc gọi và tạo báo cáo lâm sàng có cấu trúc:
    1. Xác định tình trạng tuân thủ uống thuốc.
    2. Trích xuất danh sách triệu chứng phát hiện.
    3. Đánh giá phát hiện trường hợp cần nhân viên y tế liên hệ lại.
    4. Sinh văn bản tóm tắt ngắn gọn súc tích cho bác sĩ/điều dưỡng.
    """
    elder_clean_name = elder_name or "Bệnh nhân"

    # Trường hợp 1: Bệnh nhân không nghe máy hoặc cuộc gọi thất bại
    if call_status in [CallStatus.NO_ANSWER, CallStatus.BUSY, CallStatus.FAILED]:
        status_vi = "Bệnh nhân không nghe máy" if call_status == CallStatus.NO_ANSWER else "Bệnh nhân bận máy / từ chối"
        return {
            "medication_adherence": MedicationAdherence.UNCONFIRMED,
            "adherence_notes": f"Không thể xác nhận do {status_vi.lower()}.",
            "reported_symptoms": [],
            "patient_mood": "Không xác định",
            "requires_followup": True,
            "followup_priority": FollowupPriority.MEDIUM,
            "followup_reason": f"{status_vi} sau cuộc gọi tự động định kỳ ({scheduled_time or 'Hôm nay'}).",
            "summary_report": (
                f"⚠️ CUỘC GỌI KHÔNG THÀNH CÔNG: Hệ thống AI đã kết nối đến số {elder_phone or 'đăng ký'} "
                f"của {elder_clean_name} nhưng {status_vi.lower()}. "
                f"Đề xuất: Nhân viên y tế hoặc người chăm sóc chủ động gọi điện liên hệ lại để kiểm tra an toàn."
            ),
        }

    # Trường hợp 2: Cuộc gọi thành công, phân tích lược sử đối thoại
    patient_utterances = []
    for turn in transcript:
        speaker = str(turn.get("speaker", "")).upper()
        if speaker in ["PATIENT", "ELDER", "USER", "NGUOI_BENH"]:
            patient_utterances.append(str(turn.get("text", "")).strip())

    combined_patient_text = " ".join(patient_utterances).lower()

    # 1. Phân tích tuân thủ uống thuốc
    adherence = MedicationAdherence.UNCONFIRMED
    adherence_notes = "Chưa rõ thông tin uống thuốc qua trao đổi."

    has_positive = any(k in combined_patient_text for k in ADHERENCE_POSITIVE)
    has_negative = any(k in combined_patient_text for k in ADHERENCE_NEGATIVE)

    if has_negative:
        adherence = MedicationAdherence.NOT_TAKEN
        adherence_notes = "Bác cho biết CHƯA UỐNG THUỐC hoặc quên uống."
    elif has_positive:
        adherence = MedicationAdherence.TAKEN
        adherence_notes = "Bác xác nhận ĐÃ UỐNG THUỐC đầy đủ theo chỉ định."
    elif "uống 1 viên" in combined_patient_text or "mới uống một nửa" in combined_patient_text:
        adherence = MedicationAdherence.PARTIAL
        adherence_notes = "Bác chỉ mới uống một phần thuốc."

    # 2. Phát hiện triệu chứng
    detected_symptoms = []
    highest_symptom_priority = FollowupPriority.NONE

    for kw, sym_name, prio in CLINICAL_SYMPTOMS_MAP:
        if kw in combined_patient_text:
            if sym_name not in detected_symptoms:
                detected_symptoms.append(sym_name)
            if prio == FollowupPriority.CRITICAL:
                highest_symptom_priority = FollowupPriority.CRITICAL
            elif prio == FollowupPriority.HIGH and highest_symptom_priority != FollowupPriority.CRITICAL:
                highest_symptom_priority = FollowupPriority.HIGH
            elif prio == FollowupPriority.MEDIUM and highest_symptom_priority in [FollowupPriority.NONE, FollowupPriority.LOW]:
                highest_symptom_priority = FollowupPriority.MEDIUM

    # 3. Phát hiện yêu cầu hỗ trợ từ nhân viên y tế
    assistance_requested = any(kw in combined_patient_text for kw in ASSISTANCE_REQUEST_KEYWORDS)

    # 4. Đánh giá tâm trạng / thể trạng
    if "khỏe" in combined_patient_text or "bình thường" in combined_patient_text or "tốt" in combined_patient_text:
        patient_mood = "Ổn định / Khỏe"
    elif "mệt" in combined_patient_text or "yếu" in combined_patient_text or "đau" in combined_patient_text:
        patient_mood = "Mệt mỏi / Cần chú ý"
    elif "lo" in combined_patient_text or "sợ" in combined_patient_text:
        patient_mood = "Lo lắng"
    else:
        patient_mood = "Bình thường"

    # 5. QUY TẮC TRIAGE: Phát hiện trường hợp cần nhân viên y tế liên hệ lại
    # AI KHÔNG TỰ CHẨN ĐOÁN HAY THAY ĐỔI ĐƠN THUỐC -> Chuyển nhân viên y tế xử lý
    requires_followup = False
    followup_priority = FollowupPriority.NONE
    followup_reasons = []

    if assistance_requested:
        requires_followup = True
        followup_reasons.append("Bệnh nhân chủ động yêu cầu nhân viên y tế hỗ trợ")
        if followup_priority != FollowupPriority.CRITICAL:
            followup_priority = FollowupPriority.HIGH

    if highest_symptom_priority == FollowupPriority.CRITICAL:
        requires_followup = True
        followup_priority = FollowupPriority.CRITICAL
        followup_reasons.append(f"Xuất hiện triệu chứng KHẨN CẤP ({', '.join(detected_symptoms)})")
    elif highest_symptom_priority == FollowupPriority.HIGH:
        requires_followup = True
        if followup_priority != FollowupPriority.CRITICAL:
            followup_priority = FollowupPriority.HIGH
        followup_reasons.append(f"Bệnh nhân báo triệu chứng ({', '.join(detected_symptoms)})")

    if adherence == MedicationAdherence.NOT_TAKEN:
        requires_followup = True
        if followup_priority not in [FollowupPriority.CRITICAL, FollowupPriority.HIGH]:
            followup_priority = FollowupPriority.MEDIUM
        followup_reasons.append("Bệnh nhân chưa uống thuốc theo cữ đã định")

    if not requires_followup:
        followup_priority = FollowupPriority.NONE
        followup_reason = "Tình trạng ổn định, tuân thủ dùng thuốc tốt."
    else:
        followup_reason = " • ".join(followup_reasons)

    # 6. TỰ ĐỘNG TẠO BẢN TÓM TẮT LÂM SÀNG CÓ CẤU TRÚC (CLINICAL SUMMARY)
    summary_parts = []
    summary_parts.append(f"Cuộc gọi hỏi thăm tự động ({duration_seconds} giây).")
    
    if adherence == MedicationAdherence.TAKEN:
        summary_parts.append(f"✓ Đã uống thuốc: {adherence_notes}")
    elif adherence == MedicationAdherence.NOT_TAKEN:
        summary_parts.append(f"✗ Chưa uống thuốc: Cần nhắc nhở hoặc kiểm tra lý do.")
    else:
        summary_parts.append(f"? Trạng thái uống thuốc: {adherence_notes}")

    if detected_symptoms:
        summary_parts.append(f"⚠️ Triệu chứng ghi nhận: {', '.join(detected_symptoms)}.")
    else:
        summary_parts.append("✓ Không ghi nhận triệu chứng bất thường.")

    if assistance_requested:
        summary_parts.append("🚨 Bệnh nhân bày tỏ mong muốn được nhân viên y tế tư vấn thêm.")

    if requires_followup:
        summary_parts.append(
            f"👉 ĐỀ XUẤT CAN THIỆP: [Ưu tiên: {followup_priority}] - Nhân viên y tế cần liên hệ lại: {followup_reason}."
        )
    else:
        summary_parts.append("👉 Bệnh nhân ổn định, tiếp tục theo dõi theo lịch trình.")

    summary_parts.append(
        "\n(Lưu ý: AI không tự chẩn đoán hay thay đổi đơn thuốc. Dữ liệu phục vụ nhân viên y tế đối chiếu lâm sàng)."
    )

    summary_report = " ".join(summary_parts)

    return {
        "medication_adherence": adherence,
        "adherence_notes": adherence_notes,
        "reported_symptoms": detected_symptoms,
        "patient_mood": patient_mood,
        "requires_followup": requires_followup,
        "followup_priority": followup_priority,
        "followup_reason": followup_reason,
        "summary_report": summary_report,
    }
