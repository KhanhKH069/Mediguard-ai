# ==============================================================================
# MEDIGUARD CARE - 100% RED FLAG TRIAGE SAFETY VERIFICATION TEST
# Clinical Safety Rule: 0% False Negatives on Critical Medical Emergencies
# ==============================================================================

import pytest
from app.services.clinical_triage.rule_engine import rule_engine
from app.schemas.triage_schema import TriageLevel
from app.schemas.extraction_schema import (
    PostOpExtractionResult,
    SymptomField,
    ConfidenceLevel,
    SourceType,
    EvolutionTrend,
    WoundExudate
)


def _create_mock_extraction(
    vas=5,
    temp=36.8,
    wound_exudate=WoundExudate.DRY,
    breathing_difficulty=False,
    pain_trend=EvolutionTrend.STABLE
) -> PostOpExtractionResult:
    return PostOpExtractionResult(
        patient_verified=True,
        pain_status=SymptomField(value=f"VAS {vas}", confidence=ConfidenceLevel.HIGH, evidence_quote="quote"),
        pain_trend=SymptomField(value=pain_trend.value, confidence=ConfidenceLevel.HIGH, evidence_quote="quote"),
        pain_vas=vas,
        wound_condition=SymptomField(value="Bình thường", confidence=ConfidenceLevel.HIGH, evidence_quote="quote"),
        wound_exudate=SymptomField(value=wound_exudate.value, confidence=ConfidenceLevel.HIGH, evidence_quote="quote"),
        fever_status=SymptomField(value="Bình thường", confidence=ConfidenceLevel.HIGH, evidence_quote="quote"),
        temperature_celsius=temp,
        medication_adherence=SymptomField(value="Đầy đủ", confidence=ConfidenceLevel.HIGH, evidence_quote="quote"),
        breathing_difficulty=breathing_difficulty,
        immediate_escalation_needed=breathing_difficulty or wound_exudate == WoundExudate.FRESH_BLOOD
    )


def test_high_fever_triggers_red_flag():
    """Ca sốt cao >= 38.5°C BẮT BUỘC phải gán mức ĐỎ (RED)"""
    extracted = _create_mock_extraction(temp=38.9)
    result = rule_engine.evaluate_triage(extracted, {}, current_day=3)
    assert result.triage_level == TriageLevel.RED
    assert result.sla_deadline_minutes == 15


def test_breathing_difficulty_triggers_red_flag():
    """Ca khó thở cấp tính sau mổ BẮT BUỘC gán mức ĐỎ (RED)"""
    extracted = _create_mock_extraction(breathing_difficulty=True)
    result = rule_engine.evaluate_triage(extracted, {}, current_day=1)
    assert result.triage_level == TriageLevel.RED
    assert result.sla_deadline_minutes == 15


def test_fresh_blood_triggers_red_flag():
    """Ca chảy máu đỏ tươi vết mổ BẮT BUỘC gán mức ĐỎ (RED)"""
    extracted = _create_mock_extraction(wound_exudate=WoundExudate.FRESH_BLOOD)
    result = rule_engine.evaluate_triage(extracted, {}, current_day=2)
    assert result.triage_level == TriageLevel.RED
    assert result.sla_deadline_minutes == 15


def test_worsening_pain_day3_triggers_orange_flag():
    """Ca đau tăng sau ngày 3 BẮT BUỘC gán mức CAM (ORANGE) SLA 4 giờ"""
    extracted = _create_mock_extraction(pain_trend=EvolutionTrend.WORSENING, vas=6)
    result = rule_engine.evaluate_triage(extracted, {}, current_day=3)
    assert result.triage_level == TriageLevel.ORANGE
    assert result.sla_deadline_minutes == 240


def test_routine_patient_is_green():
    """Ca bình thường, không sốt, vết mổ khô BẮT BUỘC gán mức XANH (GREEN)"""
    extracted = _create_mock_extraction(vas=2, temp=36.6, wound_exudate=WoundExudate.DRY)
    result = rule_engine.evaluate_triage(extracted, {}, current_day=7)
    assert result.triage_level == TriageLevel.GREEN
