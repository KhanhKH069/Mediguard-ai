import pytest
from app.core.rule_engine import evaluate_safety_and_intent

def test_reject_dangerous_requests():
    """
    Kiểm thử quan trọng: Bắt buộc từ chối và chặn đứng khi người dùng yêu cầu:
    - 'uống bù'
    - 'uống gấp đôi'
    - 'tăng liều'
    """
    dangerous_inputs = [
        "Sáng nay bác quên, giờ trưa bác uống bù được không cháu?",
        "Bác muốn uống gấp đôi cho nhanh khỏi",
        "Có nên tăng liều thuốc huyết áp không?",
        "Bác thấy mệt nên bác bỏ cữ tối nhé"
    ]

    for sentence in dangerous_inputs:
        res = evaluate_safety_and_intent(sentence)
        assert res["is_safe"] is False, f"Thất bại! Câu '{sentence}' phải bị chặn."
        assert res["action"] == "REJECT_AND_NOTIFY_CAREGIVER"
        assert res["warning_reason"] is not None
        assert "đừng tự ý thay đổi" in res["reply_speech"]

def test_detect_acute_symptoms():
    """
    Kiểm thử: Phát hiện triệu chứng cấp tính và kích hoạt báo động.
    """
    symptom_inputs = [
        "Bác thấy chóng mặt quá cháu ơi",
        "Bác bị đau bụng dữ dội",
        "Hình như bác uống nhầm thuốc rồi"
    ]

    for sentence in symptom_inputs:
        res = evaluate_safety_and_intent(sentence)
        assert res["is_safe"] is False
        assert res["action"] == "EMERGENCY_ALERT"

def test_allow_normal_confirmation():
    """
    Kiểm thử: Cho phép các câu phản hồi thông thường.
    """
    normal_inputs = [
        "Bác uống thuốc rồi nhé",
        "Đã uống xong cữ sáng",
        "Đã nghe nhắc rồi"
    ]

    for sentence in normal_inputs:
        res = evaluate_safety_and_intent(sentence)
        assert res["is_safe"] is True
        assert res["intent"] == "CONFIRM_INTAKE"
