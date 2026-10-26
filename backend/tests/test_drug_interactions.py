import pytest
from app.core.drug_checker import check_drug_interactions, normalize_to_active_ingredient

def test_detect_high_risk_interaction():
    """
    Kiểm thử: Phát hiện tương tác nguy hiểm giữa Ginkgo Biloba và Aspirin.
    """
    meds = ["Amlodipine 5mg", "Ginkgo Biloba 120mg", "Aspirin 81mg"]
    result = check_drug_interactions(meds)

    assert result["has_interaction"] is True
    assert result["severity_level"] == "HIGH"
    assert result["total_interactions"] >= 1

    titles = [i["title"] for i in result["detected_interactions"]]
    assert any("xuất huyết" in t.lower() for t in titles)

def test_detect_moderate_interaction():
    """
    Kiểm thử: Phát hiện tương tác hạ áp giữa Amlodipine và Losartan.
    """
    meds = ["Amlodipine 5mg", "Losartan 50mg"]
    result = check_drug_interactions(meds)

    assert result["has_interaction"] is True
    assert result["severity_level"] == "MODERATE"

def test_safe_medications():
    """
    Kiểm thử: Đơn thuốc không có tương tác bất lợi.
    """
    meds = ["Amlodipine 5mg", "Omeprazole 20mg"]
    result = check_drug_interactions(meds)

    assert result["has_interaction"] is False
    assert result["severity_level"] == "SAFE"

def test_normalize_drug_name():
    """
    Kiểm thử: Chuẩn hóa biệt dược về tên hoạt chất chính.
    """
    assert normalize_to_active_ingredient("Viên huyết áp Amlor 5mg") == "amlodipine"
    assert normalize_to_active_ingredient("Hoạt huyết Tanakan (Ginkgo Biloba)") == "ginkgo biloba"
    assert normalize_to_active_ingredient("Plavix 75mg") == "clopidogrel"
