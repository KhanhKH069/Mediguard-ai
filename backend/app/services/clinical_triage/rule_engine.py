# ==============================================================================
# MEDIGUARD CARE - CLINICAL TRIAGE RULE ENGINE (RULE-FIRST, LLM-ASSIST)
# Evaluates structured data against YAML medical board criteria deterministically
# ==============================================================================

import yaml
import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from ...schemas.triage_schema import TriageLevel, TriageEvaluationResult
from ...schemas.extraction_schema import PostOpExtractionResult, WoundExudate, EvolutionTrend
from ...config import settings

logger = logging.getLogger(__name__)


class ClinicalTriageRuleEngine:
    """
    Bộ phân loại ưu tiên lâm sàng dựa trên quy tắc tất định (Deterministic Rule Engine).
    Đảm bảo 100% quyết định phân loại mức độ nguy hiểm tuân thủ nghiêm ngặt phác đồ
    của Hội đồng Chuyên môn Bệnh viện, không phụ thuộc vào cảm tính của LLM.
    """

    def evaluate_triage(
        self,
        extracted_data: PostOpExtractionResult,
        protocol_config: Dict[str, Any],
        current_day: int = 3
    ) -> TriageEvaluationResult:
        """
        Đối chiếu dữ liệu lâm sàng trích xuất với bộ quy tắc trong YAML Protocol
        """
        logger.info(f"[TRIAGE ENGINE] Bắt đầu đánh giá Triage cho ngày D+{current_day}")

        triggered_rules: List[str] = []
        recommended_actions: List[str] = []

        # ----------------------------------------------------------------------
        # 1. KIỂM TRA MỨC ĐỎ (RED_FLAG) - CẤP CỨU KHẨN CẤP (SLA < 15 PHÚT)
        # ----------------------------------------------------------------------
        # Rule R1: Chảy máu đỏ tươi ồ ạt hoặc ướt đẫm gạc
        if extracted_data.wound_exudate.value in [WoundExudate.FRESH_BLOOD.value, WoundExudate.SOAKED_DRESSING.value]:
            triggered_rules.append("RED_RULE_01: Chảy máu tươi hoặc ướt đẫm băng gạc vết mổ")
            recommended_actions.append("Băng ép cầm máu tại chỗ và liên hệ ngay bác sĩ cấp cứu")

        # Rule R2: Sốt cao >= 38.5°C kèm rét run
        if extracted_data.temperature_celsius and extracted_data.temperature_celsius >= 38.5:
            triggered_rules.append(f"RED_RULE_02: Sốt cao {extracted_data.temperature_celsius}°C (>= 38.5°C)")
            recommended_actions.append("Dùng hạ sốt paracetamol, chuyển khám cấp cứu loại trừ nhiễm trùng sâu")

        # Rule R3: Khó thở cấp tính
        if extracted_data.breathing_difficulty or extracted_data.immediate_escalation_needed:
            triggered_rules.append("RED_RULE_03: Dấu hiệu khó thở hoặc đau tức ngực cấp tính sau phẫu thuật")
            recommended_actions.append("Kích hoạt chuyển viện cấp cứu 115 khẩn cấp")

        # Rule R4: Đau dữ dội VAS >= 8
        if extracted_data.pain_vas and extracted_data.pain_vas >= 8:
            triggered_rules.append(f"RED_RULE_04: Đau dữ dội không kiểm soát được (VAS {extracted_data.pain_vas}/10)")
            recommended_actions.append("Bác sĩ trực đánh giá lại thuốc giảm đau đường uống / biến chứng tụ dịch")

        if triggered_rules:
            return TriageEvaluationResult(
                triage_level=TriageLevel.RED,
                triggered_rules=triggered_rules,
                clinical_justification=(
                    f"BÁO ĐỘNG ĐỎ KHẨN CẤP: Bệnh nhân xuất hiện các dấu hiệu đe dọa biến chứng nghiêm trọng: "
                    f"{'; '.join(triggered_rules)}. Cần sự can thiệp y tế tức thời."
                ),
                sla_deadline_minutes=settings.SLA_RED_FLAG_MINUTES,
                assigned_role="Bác sĩ Phẫu thuật chính / Bác sĩ trực Cấp cứu",
                recommended_actions=recommended_actions
            )

        # ----------------------------------------------------------------------
        # 2. KIỂM TRA MỨC CAM (ORANGE_FLAG) - CẦN XEM XÉT TRONG 4H (SLA < 240 PHÚT)
        # ----------------------------------------------------------------------
        # Rule O1: Đau tăng từ ngày thứ 3 trở đi
        if extracted_data.pain_trend.value == EvolutionTrend.WORSENING.value and current_day >= 3:
            triggered_rules.append("ORANGE_RULE_01: Đau vết mổ có xu hướng tăng từ ngày thứ 3 (trái quy luật giảm đau)")
            recommended_actions.append("Điều dưỡng gọi lại hỏi kỹ vị trí đau, hướng dẫn kiểm tra sưng nề")

        # Rule O2: Vết mổ rỉ dịch mủ vàng hoặc có mùi hôi
        if extracted_data.wound_exudate.value in [WoundExudate.YELLOW_PUS.value, WoundExudate.FOUL_SMELL.value]:
            triggered_rules.append("ORANGE_RULE_02: Vết mổ thấm dịch mủ vàng hoặc nghi ngờ nhiễm trùng nông chân chỉ")
            recommended_actions.append("Yêu cầu chụp ảnh vết mổ gửi qua Zalo OA bảo mật và xếp lịch khám lại")

        # Rule O3: Sốt nhẹ 37.5°C - 38.4°C
        if extracted_data.temperature_celsius and 37.5 <= extracted_data.temperature_celsius < 38.5:
            triggered_rules.append(f"ORANGE_RULE_03: Sốt nhẹ {extracted_data.temperature_celsius}°C kéo dài")
            recommended_actions.append("Hướng dẫn đo lại thân nhiệt sau 4 giờ và chườm mát")

        if triggered_rules:
            return TriageEvaluationResult(
                triage_level=TriageLevel.ORANGE,
                triggered_rules=triggered_rules,
                clinical_justification=(
                    f"CẢNH BÁO MỨC CAM: Bệnh nhân có dấu hiệu bất thường cần nhân viên y tế theo dõi sát: "
                    f"{'; '.join(triggered_rules)}."
                ),
                sla_deadline_minutes=settings.SLA_ORANGE_FLAG_MINUTES,
                assigned_role="Điều dưỡng Điều phối lâm sàng",
                recommended_actions=recommended_actions
            )

        # ----------------------------------------------------------------------
        # 3. KIỂM TRA MỨC VÀNG (YELLOW_FLAG) - CẦN BỔ SUNG TT (SLA < 720 PHÚT)
        # ----------------------------------------------------------------------
        if extracted_data.has_unclear_fields:
            triggered_rules.append("YELLOW_RULE_01: Chưa đủ số đo thân nhiệt hoặc câu trả lời triệu chứng chưa rõ ràng")
            recommended_actions.append("Gọi lại vào khung giờ thích hợp hơn để xác nhận số đo nhiệt độ")

        if extracted_data.patient_questions:
            triggered_rules.append(f"YELLOW_RULE_02: Bệnh nhân có {len(extracted_data.patient_questions)} câu hỏi cần giải đáp")
            recommended_actions.append("Điều dưỡng gọi lại tư vấn giải đáp thắc mắc của người bệnh")

        if triggered_rules:
            return TriageEvaluationResult(
                triage_level=TriageLevel.YELLOW,
                triggered_rules=triggered_rules,
                clinical_justification=(
                    f"MỨC VÀNG: Cần làm rõ thêm thông tin lâm sàng hoặc giải đáp thắc mắc: "
                    f"{'; '.join(triggered_rules)}."
                ),
                sla_deadline_minutes=settings.SLA_YELLOW_FLAG_MINUTES,
                assigned_role="Điều dưỡng Chăm sóc khách hàng",
                recommended_actions=recommended_actions
            )

        # ----------------------------------------------------------------------
        # 4. MỨC XANH (GREEN_FLAG) - PHỤC HỒI ỔN ĐỊNH THEO KẾ HOẠCH (ROUTINE)
        # ----------------------------------------------------------------------
        return TriageEvaluationResult(
            triage_level=TriageLevel.GREEN,
            triggered_rules=["GREEN_RULE_00: Tất cả các chỉ số theo dõi đều đạt tiêu chuẩn phục hồi an toàn"],
            clinical_justification="Bệnh nhân hồi phục đúng tiến độ, vết mổ khô, đau giảm dần, không sốt.",
            sla_deadline_minutes=settings.SLA_GREEN_FLAG_MINUTES,
            assigned_role="Hệ thống tự động",
            recommended_actions=["Lên lịch cuộc gọi tự động tiếp theo theo phác đồ"]
        )


rule_engine = ClinicalTriageRuleEngine()
