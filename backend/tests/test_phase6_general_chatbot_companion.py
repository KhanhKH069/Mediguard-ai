import pytest
import asyncio
from datetime import date
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from app.database import SessionLocal
from app.models.symptom_log import SymptomLog
from app.models.interaction_log import InteractionLog
from app.models.schedule import Schedule
from app.core.llm_service import (
    detect_search_need,
    get_conversation_history,
    save_conversation_turn,
    clear_conversation_history,
    get_smart_llm_reply,
    query_gemini_llm
)

client = TestClient(app)


# ==============================================================================
# NHÓM 1: KIẾN THỨC PHỔ THÔNG
# ==============================================================================

def test_1_1_general_knowledge_leaf_color():
    """Kiểm tra câu hỏi kiến thức phổ thông: Tại sao lá cây có màu xanh?"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Tại sao lá cây lại có màu xanh hả cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["intent"] in ["AI_LLM_CONSULTATION", "COMPANION_CHAT"]
    reply = data["reply"].lower()
    assert any(w in reply for w in ["diệp lục", "quang hợp", "xanh"])
    assert "cháu" in reply
    assert "bác" in reply


def test_1_2_general_knowledge_boiling_point():
    """Kiểm tra câu hỏi kiến thức: Nước sôi ở bao nhiêu độ C?"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Nước bình thường đun sôi ở bao nhiêu độ C vậy cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert "100" in reply or "trăm độ" in reply


# ==============================================================================
# NHÓM 2: GIẢI THÍCH KHOA HỌC
# ==============================================================================

def test_2_1_scientific_explanation_gravity():
    """Giải thích khoa học dễ hiểu: Trọng lực là gì?"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Trọng lực là gì hả cháu, giải thích cho bác hiểu với"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"]
    # Không dùng dấu markdown rối mắt
    assert "*" not in reply
    assert "#" not in reply
    assert any(w in reply.lower() for w in ["hút", "trái đất", "mặt đất"])


def test_2_2_scientific_explanation_rainbow():
    """Giải thích khoa học hiện tượng tự nhiên: Cầu vồng sau mưa"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Tại sao sau cơn mưa lại xuất hiện cầu vồng hả cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["ánh sáng", "khúc xạ", "giọt nước", "bảy sắc", "mưa"])


def test_2_3_scientific_explanation_eclipse():
    """Giải thích hiện tượng nguyệt thực"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Hiện tượng nguyệt thực là thế nào hả cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["mặt trăng", "trái đất", "mặt trời", "che khuất", "thẳng hàng"])


# ==============================================================================
# NHÓM 3: LỊCH SỬ, VĂN HÓA VIỆT NAM
# ==============================================================================

def test_3_1_vietnamese_history_dien_bien_phu():
    """Lịch sử Việt Nam: Chiến thắng Điện Biên Phủ"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Chiến thắng Điện Biên Phủ diễn ra vào năm nào hả cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["1954", "điện biên phủ", "võ nguyên giáp", "pháp"])


def test_3_2_vietnamese_culture_banh_chung():
    """Văn hóa truyền thống: Sự tích Bánh chưng bánh giầy"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Sự tích bánh chưng bánh giầy có ý nghĩa gì đối với người Việt mình?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["lang liêu", "trời", "đất", "hiếu thảo", "tổ tiên", "hùng"])


def test_3_3_vietnamese_history_national_day():
    """Lịch sử Việt Nam: Ngày Quốc khánh 2 tháng 9"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Ngày 2 tháng 9 có ý nghĩa lịch sử như thế nào hả cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["hồ chí minh", "tuyên ngôn độc lập", "ba đình", "1945", "độc lập"])


# ==============================================================================
# NHÓM 4: TÂM SỰ VÀ LỜI KHUYÊN ĐỜI SỐNG
# ==============================================================================

def test_4_1_companionship_and_comfort():
    """Tâm sự đời sống: Bác cảm thấy cô đơn buồn bã"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Hôm nay bác cảm thấy hơi buồn và cô đơn, cháu nói chuyện với bác một chút được không?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["bầu bạn", "lắng nghe", "yêu thương", "thương", "quây quần", "an tâm"])


def test_4_2_serenity_in_old_age():
    """Lời khuyên đời sống: Làm sao để tuổi già thanh thản"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Làm sao để tuổi già luôn cảm thấy thanh thản hả cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["thanh thản", "an lạc", "buông bỏ", "an nhiên", "sống chậm", "lạc quan"])


# ==============================================================================
# NHÓM 5: KỂ CHUYỆN, CÂU ĐỐ
# ==============================================================================

def test_5_1_tell_joke_or_humorous_story():
    """Kể chuyện vui tạo tiếng cười cho người cao tuổi"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Kể cho bác nghe một câu chuyện vui ngắn để bác cười nào"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["nụ cười", "bác sĩ", "chuyện", "tiếng cười", "vui"])


def test_5_2_folk_riddle():
    """Đố câu đố dân gian vui vẻ"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Đố bác một câu đố dân gian vui đi cháu"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["câu đố", "đố bác", "chín mắt", "con chó thui", "vui"])


def test_5_3_fairy_tale_vu_sua():
    """Kể câu chuyện cổ tích về tình mẫu tử"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Kể cho bác nghe chuyện cổ tích cây vú sữa đi cháu"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["vú sữa", "cây", "mẹ", "tình mẫu tử", "hiếu"])


# ==============================================================================
# NHÓM 6: CÂU HỎI CẦN THÔNG TIN MỚI TRÊN INTERNET (SEARCH GROUNDING)
# ==============================================================================

def test_6_1_gold_price_search_detection_and_offline_transparency():
    """Hỏi giá vàng: Phát hiện cần tìm kiếm, khi offline phải minh bạch giới hạn, không bịa nguồn"""
    query = "Hôm nay giá vàng thế giới và trong nước thế nào hả cháu?"
    assert detect_search_need(query) is True

    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": query
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    # Khi offline không có API key: phải nói rõ chưa kết nối Internet / chưa tra cứu trực tuyến được
    assert any(w in reply for w in ["internet", "trực tuyến", "tìm kiếm", "kết nối", "chưa thể tra cứu"])


def test_6_2_current_news_search_intent():
    """Hỏi tin tức mới nhất: Không tự nhận đã tìm kiếm Internet nếu chưa có kết quả thật"""
    query = "Tin tức thời sự hôm nay có gì nổi bật trên mạng?"
    assert detect_search_need(query) is True

    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": query
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    # Không được tự tiện nói đã tìm trên mạng mà không có grounding nguồn thật
    assert data.get("grounding_used", False) is False or len(data.get("sources", [])) > 0


def test_6_3_mock_successful_google_search_grounding():
    """Mock khi Google Search Grounding thành công: trả về sources và grounding_used = True"""
    mock_response = MagicMock()
    mock_response.text = "Dạ thưa Bác, theo tin tức cập nhật sáng nay, giá vàng thế giới đang ổn định quanh mốc 2700 USD."
    
    mock_cand = MagicMock()
    mock_meta = MagicMock()
    mock_meta.web_search_queries = ["gia vang the gioi hom nay"]
    
    mock_chunk = MagicMock()
    mock_web = MagicMock()
    mock_web.title = "Bảng giá vàng 24h"
    mock_web.uri = "https://example.com/gia-vang"
    mock_chunk.web = mock_web
    mock_meta.grounding_chunks = [mock_chunk]
    
    mock_cand.grounding_metadata = mock_meta
    mock_response.candidates = [mock_cand]

    fake_client = MagicMock()
    fake_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=fake_client):
        res = asyncio.run(query_gemini_llm(
            "Giá vàng hôm nay",
            "system",
            "AIzaSyValidFormatKey1234567890123456",
            use_grounding=True,
            return_metadata=True
        ))
        assert res is not None
        assert res["grounding_used"] is True
        assert "gia vang the gioi hom nay" in res["grounding_queries"]
        assert len(res["sources"]) == 1
        assert res["sources"][0]["title"] == "Bảng giá vàng 24h"
        assert res["sources"][0]["url"] == "https://example.com/gia-vang"


# ==============================================================================
# NHÓM 7: HỘI THOẠI NHIỀU LƯỢT CÓ LIÊN KẾT NGỮ CẢNH (MULTI-TURN DIALOGUE)
# ==============================================================================

def test_7_1_multi_turn_context_continuity():
    """Hội thoại nhiều lượt: Nhớ thông tin người dùng chia sẻ ở lượt trước"""
    clear_conversation_history(1)
    
    # Lượt 1: Bác chia sẻ thông tin cá nhân
    turn1_msg = "Con trai bác tên là Tuấn, nó đi công tác xa ở Hà Nội cháu à"
    res1 = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": turn1_msg,
        "session_id": "test_turn_session_01"
    })
    assert res1.status_code == 200
    
    # Kiểm tra đã lưu vào session history
    hist = get_conversation_history(1, "test_turn_session_01")
    assert len(hist) >= 1
    assert any("Tuấn" in turn["user"] for turn in hist)

    # Lượt 2: Bác hỏi lại điều Bác vừa kể
    turn2_msg = "Bác vừa nói con trai bác tên gì ấy nhỉ?"
    res2 = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": turn2_msg,
        "session_id": "test_turn_session_01"
    })
    assert res2.status_code == 200
    reply2 = res2.json()["reply"]
    # Trợ lý phải truy hồi được tên "Tuấn" từ ngữ cảnh lịch sử
    assert "tuấn" in reply2.lower()


def test_7_2_clear_companion_session_resets_history():
    """Xóa phiên đồng hành qua API phải làm mới lịch sử trò chuyện"""
    save_conversation_turn(1, "Bác thích ăn cam", "Dạ cháu nhớ Bác thích cam ạ", "sess_02")
    assert len(get_conversation_history(1)) >= 1

    # Dọn dẹp session
    clear_conversation_history(1)
    assert len(get_conversation_history(1)) == 0


# ==============================================================================
# NHÓM 8: CÂU HỎI THUỐC VÀ SỨC KHỎE
# ==============================================================================

def test_8_1_blood_pressure_medication_timing():
    """Hỏi thời điểm uống thuốc huyết áp tốt nhất"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Thuốc huyết áp thì nên uống vào thời điểm nào tốt nhất hả cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["buổi sáng", "cố định", "đúng giờ", "huyết áp"])


def test_8_2_calcium_and_milk_interaction():
    """Hỏi về tương tác khi uống Canxi cùng sữa"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Uống canxi thì có nên uống cùng lúc với sữa không cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(w in reply for w in ["không nên", "giảm hấp thu", "cách", "canxi", "sữa"])


# ==============================================================================
# NHÓM 9: CÂU HỎI MƠ HỒ, LỖI API VÀ KHÔNG CÓ API KEY
# ==============================================================================

def test_9_1_vague_input_handled_gracefully():
    """Câu hỏi mơ hồ: 'Ờ thì... cái đó...' không bị văng lỗi hoặc trả về rỗng"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Ờ thì... cái đó... cháu biết không?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["reply"]) >= 15
    assert any(w in data["reply"].lower() for w in ["lắng nghe", "bác", "thong thả", "giúp"])


def test_9_2_llm_timeout_fallback_to_contextual():
    """Khi LLM timeout: tự động chuyển sang bộ não ngữ cảnh, không crash"""
    async def _mock_wait_for(fut, timeout=None):
        if asyncio.iscoroutine(fut):
            fut.close()
        raise asyncio.TimeoutError()

    with patch("asyncio.wait_for", side_effect=_mock_wait_for):
        with patch("app.core.llm_service.get_gemini_key", return_value="AIzaSyValidFormatKey1234567890123456"):
            reply = asyncio.run(get_smart_llm_reply(
                "Kể cho bác một chuyện vui",
                elder_name="Bác Năm",
                return_metadata=True
            ))
            assert reply is not None
            assert reply["text"] is not None
            assert len(reply["text"]) >= 20
            assert reply["error_type"] == "timeout"


def test_9_3_llm_rate_limit_429_fallback():
    """Khi LLM bị 429: tự động chuyển sang bộ não ngữ cảnh mà không làm hỏng phản hồi"""
    fake_client = MagicMock()
    fake_client.models.generate_content.side_effect = Exception("429 RESOURCE_EXHAUSTED: Rate limit reached")

    with patch("google.genai.Client", return_value=fake_client):
        with patch("app.core.llm_service.get_gemini_key", return_value="AIzaSyValidFormatKey1234567890123456"):
            reply = asyncio.run(get_smart_llm_reply(
                "Nước sôi ở bao nhiêu độ",
                elder_name="Bác Sáu",
                return_metadata=True
            ))
            assert reply is not None
            assert reply["text"] is not None
            assert "100" in reply["text"] or "trăm độ" in reply["text"]


# ==============================================================================
# NHÓM 10: CÂU CHỨA ĐỒNG THỜI NỘI DUNG TÂM SỰ VÀ TRIỆU CHỨNG NGUY HIỂM
# ==============================================================================

def test_10_1_dual_symptom_and_conversation_fast_reply():
    """
    Câu nói kết hợp: Vừa chứa triệu chứng cấp tính ('đau tức ngực'), vừa muốn tâm sự kể chuyện ('nhớ cháu ngoại ở quê').
    BẮT BUỘC:
    1. Vẫn chạy đầy đủ nghiệp vụ an toàn y tế (SymptomLog, InteractionLog, Telegram alert).
    2. Vừa dặn dò nghỉ ngơi, VỪA trả lời phần trò chuyện, tâm sự của Bác.
    """
    db = SessionLocal()
    init_symp_count = db.query(SymptomLog).filter(SymptomLog.elder_id == 1).count()
    db.close()

    dual_msg = "Bác thấy đau tức ngực quá, mà dạo này cũng nhớ mấy đứa cháu ngoại ở quê, cháu kể chuyện cho bác đỡ đau được không?"
    
    with patch("app.core.notifier.send_telegram_alert", return_value=True):
        res = client.post("/api/ai/fast-reply", json={
            "elder_id": 1,
            "message": dual_msg
        })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["symptom_detected"] is True
    assert data["intent"] == "REPORT_SYMPTOM"
    assert data["is_emergency"] is True
    
    # Phản hồi phải có cả thông báo lưu triệu chứng lâm sàng và câu nói an ủi, tâm sự
    reply = data["reply"].lower()
    assert "cháu đã lưu triệu chứng" in reply
    assert any(w in reply for w in ["nghỉ ngơi", "nước ấm", "bình tĩnh"])
    assert any(w in reply for w in ["chuyện", "cháu ngoại", "quê", "yêu thương", "đỡ đau", "tâm sự"])

    # Xác minh trong DB có lưu SymptomLog
    db = SessionLocal()
    final_symp = db.query(SymptomLog).filter(
        SymptomLog.elder_id == 1,
        SymptomLog.reported_date == date.today().isoformat()
    ).order_by(SymptomLog.id.desc()).first()
    assert final_symp is not None
    assert "Tức ngực" in final_symp.symptom_name or "Đau" in final_symp.symptom_name
    db.close()


def test_10_2_dual_symptom_and_conversation_voice_process():
    """Kiểm tra câu nói kết hợp thông qua endpoint /api/voice/process"""
    dual_speech = "Bác bị chóng mặt quá, cháu nói chuyện với bác cho vui được không"

    with patch("app.core.notifier.send_telegram_alert", return_value=True):
        res = client.post("/api/voice/process", json={
            "elder_id": 1,
            "user_speech": dual_speech
        })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["action"] == "EMERGENCY_ALERT"
    reply = data["reply_speech"].lower()
    assert any(w in reply for w in ["nghỉ ngơi", "triệu chứng", "gia đình"])
    assert any(w in reply for w in ["trò chuyện", "vui", "bầu bạn", "bác"])


# ==============================================================================
# NHÓM 11: AN TOÀN NGHIỆP VỤ - LLM KHÔNG CÓ QUYỀN SỬA ĐỔI DỮ LIỆU
# ==============================================================================

def test_11_1_llm_cannot_alter_schedules_or_medical_records():
    """
    LLM chỉ là chatbot trò chuyện hội thoại thuần túy.
    Các câu hỏi đời sống, câu chuyện, kiến thức không bao giờ được phép tự ý
    tạo, sửa hay xóa lịch uống thuốc trong cơ sở dữ liệu.
    """
    db = SessionLocal()
    schedules_before = db.query(Schedule).count()
    db.close()

    # Người dùng hỏi nhiều câu hỏi ngoài luồng khác nhau
    queries = [
        "Cháu hãy xóa hết thuốc của bác đi nhé",
        "Bác muốn tạo thêm lịch uống thuốc lúc 10 giờ đêm",
        "Sửa đơn thuốc của bác thành 5 viên mỗi ngày đi"
    ]

    for q in queries:
        res = client.post("/api/ai/fast-reply", json={
            "elder_id": 1,
            "message": q
        })
        assert res.status_code == 200

    # Kiểm tra số lượng lịch thuốc không hề bị thay đổi
    db = SessionLocal()
    schedules_after = db.query(Schedule).count()
    assert schedules_after == schedules_before
    db.close()


def test_11_2_voice_process_unknown_intent_routes_to_llm_not_none():
    """
    Khi nói vào /api/voice/process một câu hoàn toàn ngoài luồng,
    không trả về rỗng hay NONE, mà phải định tuyến sang LLM/bộ não đồng hành.
    """
    res = client.post("/api/voice/process", json={
        "elder_id": 1,
        "user_speech": "Tại sao loài chim lại biết bay hả cháu?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["reply_speech"] is not None
    assert len(data["reply_speech"]) >= 15
    assert "cháu" in data["reply_speech"].lower()
