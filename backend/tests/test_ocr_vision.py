import pytest
from app.vision.ocr_service import match_medication_text

def test_ocr_text_matching_success():
    """
    Kiểm thử: Nhận diện chính xác tên thuốc từ danh sách từ ngữ OCR đọc được.
    """
    extracted_items = [
        ("AMLODIPINE", 0.95),
        ("5mg", 0.92),
        ("Pfizer", 0.88),
        ("EXP 2027", 0.80)
    ]
    eval_res = match_medication_text(extracted_items, "Amlodipine 5mg")
    assert eval_res["has_match"] is True
    assert eval_res["ocr_score"] >= 0.7
    assert "amlodipine" in [kw.lower() for kw in eval_res["matched_keywords"]]

def test_ocr_text_matching_fuzzy():
    """
    Kiểm thử: Fuzzy matching khi OCR bị nhầm 1 ký tự (Amlodipne thay vì Amlodipine).
    """
    extracted_items = [
        ("Amlodipne", 0.85),
        ("5mg", 0.90)
    ]
    eval_res = match_medication_text(extracted_items, "Amlodipine 5mg")
    assert eval_res["has_match"] is True
    assert eval_res["ocr_score"] >= 0.5

def test_ocr_text_matching_mismatch():
    """
    Kiểm thử: Khi nhãn thuốc khác hoàn toàn (Paracetamol vs Amlodipine).
    """
    extracted_items = [
        ("PARACETAMOL", 0.98),
        ("500mg", 0.95)
    ]
    eval_res = match_medication_text(extracted_items, "Amlodipine 5mg")
    assert eval_res["has_match"] is False
    assert eval_res["ocr_score"] == 0.0
