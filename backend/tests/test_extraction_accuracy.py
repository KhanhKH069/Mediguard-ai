# ==============================================================================
# MEDIGUARD CARE - CLINICAL EXTRACTION ACCURACY TEST
# Benchmark suite with Vietnamese patient real-world speech phrases
# ==============================================================================

import pytest
import asyncio
from app.services.llm_extraction.extractor import clinical_extractor
from app.schemas.extraction_schema import WoundExudate, EvolutionTrend


def test_colloquial_fever_extraction():
    """
    Kiểm thử câu nói dân dã 'người hâm hấp sốt' được ánh xạ đúng và không bị hallucination
    """
    turns = [
        {"speaker": "ai", "text": "Hôm nay người bác có bị sốt không?"},
        {"speaker": "patient", "text": "Từ trưa thấy người hâm hấp sốt, đo nhiệt kế điện tử được 37 độ 8."}
    ]

    result = asyncio.run(clinical_extractor.extract_structured_symptoms(turns))

    assert result.temperature_celsius == 37.8
    assert "37 độ 8" in result.fever_status.evidence_quote or "hâm hấp sốt" in result.fever_status.evidence_quote
    assert result.fever_status.confidence.value in ["HIGH", "MEDIUM"]


def test_worsening_pain_extraction():
    """
    Kiểm thử triệu chứng đau tăng 'từ sáng giờ đau tợn hơn'
    """
    turns = [
        {"speaker": "ai", "text": "Vết mổ có bớt đau hơn không ạ?"},
        {"speaker": "patient", "text": "Từ sáng giờ thấy đau dội lên, đau tợn hơn hôm qua nhiều cô ạ, khoảng 7 điểm."}
    ]

    result = asyncio.run(clinical_extractor.extract_structured_symptoms(turns))

    assert result.pain_vas == 7
    assert result.pain_trend.value == EvolutionTrend.WORSENING.value
    assert "đau dội lên" in result.pain_trend.evidence_quote or "đau tợn hơn" in result.pain_trend.evidence_quote


def test_purulent_wound_exudate():
    """
    Kiểm thử phát hiện vết mổ rỉ dịch mủ vàng
    """
    turns = [
        {"speaker": "ai", "text": "Băng gạc vết mổ thế nào rồi bác?"},
        {"speaker": "patient", "text": "Băng hơi ướt, thấy có thấm ít dịch mủ vàng nhờn nhờn quanh rốn."}
    ]

    result = asyncio.run(clinical_extractor.extract_structured_symptoms(turns))

    assert result.wound_exudate.value == WoundExudate.YELLOW_PUS.value
    assert "mủ vàng" in result.wound_exudate.evidence_quote

