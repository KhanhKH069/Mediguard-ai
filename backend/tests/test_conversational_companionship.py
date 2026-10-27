import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_weather_inquiry_has_reasoning_and_weather_info():
    """Bác hỏi thời tiết: AI phải trả lời đúng thời tiết thực tế, không dùng câu văn mẫu chung chung"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Hôm nay thời tiết như thế nào",
        "voice": "vi-VN-Google"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["intent"] in ["AI_LLM_CONSULTATION", "COMPANION_CHAT"]
    reply_lower = data["reply"].lower()
    assert any(w in reply_lower for w in ["thời tiết", "trời", "nhiệt độ", "độ c"])
    # Tuyệt đối không được là câu văn mẫu cũ bị cứng nhắc
    assert "cháu lúc nào cũng ở đây bầu bạn và chăm sóc bác ạ" not in reply_lower


def test_companionship_and_loneliness_comfort():
    """Bác tâm sự buồn, ở nhà một mình: Chị Google phải an ủi, bầu bạn ấm áp"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Bác buồn quá ở nhà một mình cô đơn",
        "voice": "vi-VN-Google"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply_lower = data["reply"].lower()
    assert any(w in reply_lower for w in ["bầu bạn", "con cháu", "thương", "yêu thương", "quây quần", "nghỉ ngơi"])


def test_tell_joke_for_elder():
    """Bác muốn nghe chuyện vui: AI kể mẩu chuyện vui lão khoa"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Cháu kể chuyện cười cho bác nghe đi",
        "voice": "vi-VN-Google"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply_lower = data["reply"].lower()
    assert any(w in reply_lower for w in ["chuyện", "bác sĩ", "nụ cười", "vui"])


def test_senior_nutrition_advice_exact_user_query():
    """Bác hỏi đúng câu hỏi thực tế: 'Thông tin về chế độ dinh dưỡng làm sao cho người già khỏe hơn'"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Thông tin về chế độ dinh dưỡng làm sao cho người già khỏe hơn",
        "voice": "vi-VN-Google"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply_lower = data["reply"].lower()
    # Phải có tư vấn thực chất về dinh dưỡng người già
    assert any(w in reply_lower for w in ["dinh dưỡng", "mềm", "ấm", "tiêu hóa", "rau", "cá", "muối"])
    # Tuyệt đối không rơi vào câu hộp thư thoại vô cảm
    assert "cháu đã lắng nghe bác rồi ạ! cháu luôn túc trực chăm sóc bác" not in reply_lower
    assert "bác có thể hỏi cháu về thời tiết hôm nay" not in reply_lower


def test_blood_pressure_and_diabetes_consultation():
    """Bác hỏi huyết áp, tiểu đường: Chị Google hướng dẫn chuẩn y khoa"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Bác bị cao huyết áp thì nên ăn uống sinh hoạt thế nào hả cháu?",
        "voice": "vi-VN-Google"
    })
    assert res.status_code == 200
    data = res.json()
    assert "huyết áp" in data["reply"].lower()
    assert any(w in data["reply"].lower() for w in ["giảm mặn", "đúng giờ", "bác sĩ"])


def test_greeting_and_identity_google_voice():
    """Kiểm tra chào hỏi và tự giới thiệu danh tính duy nhất của Chị Google"""
    # Chào hỏi
    res_greet = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Chào cháu",
        "voice": "vi-VN-Google"
    })
    assert res_greet.status_code == 200
    assert "cháu chào bác" in res_greet.json()["reply"].lower()

    # Hỏi danh tính
    res_id = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Cháu là ai",
        "voice": "vi-VN-Google"
    })
    assert res_id.status_code == 200
    assert any(w in res_id.json()["reply"].lower() for w in ["trợ lý", "mediguard", "cháu"])
