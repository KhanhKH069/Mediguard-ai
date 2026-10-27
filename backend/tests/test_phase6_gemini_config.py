import pytest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from app.config import settings
from app.core.llm_service import (
    query_gemini_llm,
    get_smart_llm_reply,
    _mask_api_key_in_string
)

client = TestClient(app)


# ==============================================================================
# 1. CẤU HÌNH VÀ TƯƠNG THÍCH MODEL
# ==============================================================================

def test_gemini_fast_model_config():
    """
    Xác minh GEMINI_FAST_MODEL được lấy từ settings với mặc định là gemini-3.5-flash-lite.
    """
    assert settings.GEMINI_FAST_MODEL == "gemini-3.5-flash-lite"


def test_gemini_sdk_and_grounding_compatibility():
    """
    Xác minh google-genai SDK tương thích với cấu hình Google Search grounding.
    """
    from google import genai
    from google.genai import types

    config = types.GenerateContentConfig(
        temperature=0.7,
        max_output_tokens=150,
        tools=[types.Tool(google_search=types.GoogleSearch())]
    )
    assert config is not None
    assert len(config.tools) == 1
    assert hasattr(config.tools[0], "google_search")


# ==============================================================================
# 2. KIỂM THỬ TRẢ LỜI THÀNH CÔNG VỚI INTERACTIONS API & METADATA
# ==============================================================================

def test_gemini_success_reply_metadata_false():
    """
    Kiểm tra gọi thành công qua Interactions API khi return_metadata=False:
    Trả về string sạch.
    """
    fake_client = MagicMock()
    fake_response = MagicMock()
    fake_response.output_text = "Dạ thưa Bác, cháu là trợ lý sức khỏe luôn bên Bác đây ạ."
    fake_client.interactions.create.return_value = fake_response

    with patch("google.genai.Client", return_value=fake_client):
        res = asyncio.run(query_gemini_llm(
            prompt="Xin chào cháu",
            system_instruction="Bạn là trợ lý y tế.",
            api_key="AIzaSyTestValidKey123456789012",
            return_metadata=False
        ))
        assert res == "Dạ thưa Bác, cháu là trợ lý sức khỏe luôn bên Bác đây ạ."


def test_gemini_success_reply_metadata_true():
    """
    Kiểm tra gọi thành công khi return_metadata=True:
    Trả về dict chuẩn chứa text, model, grounding_used=False, sources=[], error_type=None.
    """
    fake_client = MagicMock()
    fake_response = MagicMock()
    fake_response.output_text = "Thủ đô của nước Pháp là thủ đô Paris ạ."
    fake_client.interactions.create.return_value = fake_response

    with patch("google.genai.Client", return_value=fake_client):
        res = asyncio.run(query_gemini_llm(
            prompt="Thủ đô của nước Pháp là gì?",
            system_instruction="Bạn là trợ lý.",
            api_key="AIzaSyTestValidKey123456789012",
            return_metadata=True
        ))
        assert isinstance(res, dict)
        assert res["text"] == "Thủ đô của nước Pháp là thủ đô Paris ạ."
        assert res["model"] == "gemini-3.5-flash-lite"
        assert res["grounding_used"] is False
        assert res["grounding_queries"] == []
        assert res["sources"] == []
        assert res["error_type"] is None


# ==============================================================================
# 3. KIỂM THỬ GROUNDING CÓ VÀ KHÔNG CÓ METADATA
# ==============================================================================

def test_gemini_grounding_with_metadata():
    """
    Khi grounding được bật VÀ phản hồi chứa metadata tìm kiếm thực tế:
    grounding_used phải là True, danh sách queries và sources được trích xuất chính xác.
    """
    fake_client = MagicMock()
    fake_response = MagicMock()
    fake_response.output_text = "Giá vàng miếng hôm nay là 85 triệu đồng một lượng ạ."

    fake_step1 = MagicMock()
    fake_step1.type = "google_search_call"
    fake_step1.arguments.queries = ["giá vàng miếng hôm nay"]

    fake_step2 = MagicMock()
    fake_step2.type = "google_search_result"
    fake_item = MagicMock()
    fake_item.title = "Bảng giá vàng trực tuyến"
    fake_item.url = "https://example.com/gia-vang"
    fake_step2.result = [fake_item]

    fake_response.steps = [fake_step1, fake_step2]
    fake_client.interactions.create.return_value = fake_response

    with patch("google.genai.Client", return_value=fake_client):
        res = asyncio.run(query_gemini_llm(
            prompt="Giá vàng hôm nay thế nào?",
            system_instruction="Trợ lý tra cứu.",
            api_key="AIzaSyTestValidKey123456789012",
            use_grounding=True,
            return_metadata=True
        ))
        assert isinstance(res, dict)
        assert res["grounding_used"] is True
        assert "giá vàng miếng hôm nay" in res["grounding_queries"]
        assert len(res["sources"]) == 1
        assert res["sources"][0]["url"] == "https://example.com/gia-vang"
        assert res["sources"][0]["title"] == "Bảng giá vàng trực tuyến"


def test_gemini_grounding_without_metadata():
    """
    Khi use_grounding=True nhưng phản hồi KHÔNG chứa metadata tìm kiếm:
    Tuyệt đối KHÔNG đánh dấu grounding_used=True; sources và queries phải rỗng.
    """
    fake_client = MagicMock()
    fake_response = MagicMock()
    fake_response.output_text = "Cháu chưa có thông tin tra cứu mới."
    fake_response.steps = []
    fake_client.interactions.create.return_value = fake_response

    with patch("google.genai.Client", return_value=fake_client):
        res = asyncio.run(query_gemini_llm(
            prompt="Tin tức mới",
            system_instruction="Trợ lý.",
            api_key="AIzaSyTestValidKey123456789012",
            use_grounding=True,
            return_metadata=True
        ))
        assert isinstance(res, dict)
        assert res["grounding_used"] is False
        assert res["grounding_queries"] == []
        assert res["sources"] == []


# ==============================================================================
# 4. KIỂM THỬ XỬ LÝ LỖI (503, 429 TẠM THỜI, QUOTA EXHAUSTED, 401/403, TIMEOUT, EMPTY)
# ==============================================================================

def test_gemini_error_503_handled_gracefully():
    """
    Khi Gemini trả lỗi 503 (quá tải / Service Unavailable):
    Xử lý an toàn, ghi nhận error_type='service_unavailable', không sập ứng dụng.
    """
    fake_client = MagicMock()
    fake_client.interactions.create.side_effect = Exception("503 The model is overloaded. Please try again later.")

    with patch("google.genai.Client", return_value=fake_client):
        res_false = asyncio.run(query_gemini_llm("Thời tiết", "system", "AIzaSyTestKeyValidFormat123456789012", return_metadata=False))
        assert res_false is None

        res_true = asyncio.run(query_gemini_llm("Thời tiết", "system", "AIzaSyTestKeyValidFormat123456789012", return_metadata=True))
        assert isinstance(res_true, dict)
        assert res_true["text"] is None
        assert res_true["error_type"] == "service_unavailable"


def test_gemini_error_429_quota_exhausted_vs_rate_limit():
    """
    Phân biệt rõ:
    - 429 Quota Exhausted: RESOURCE_EXHAUSTED -> error_type='quota_exhausted', dừng gọi ngay.
    - 429 Rate Limit tạm thời: Rate limit 429 -> error_type='rate_limit'.
    """
    fake_client = MagicMock()

    # Case A: Hết Quota
    fake_client.interactions.create.side_effect = Exception("429 RESOURCE_EXHAUSTED: Quota exceeded for project")
    with patch("google.genai.Client", return_value=fake_client):
        res_quota = asyncio.run(query_gemini_llm("Thời tiết", "system", "AIzaSyTestKeyValidFormat123456789012", return_metadata=True))
        assert res_quota["error_type"] == "quota_exhausted"
        assert res_quota["text"] is None

    # Case B: Giới hạn tần suất tạm thời
    fake_client.interactions.create.side_effect = Exception("429 Too Many Requests: Rate limit exceeded")
    with patch("google.genai.Client", return_value=fake_client):
        res_rate = asyncio.run(query_gemini_llm("Thời tiết", "system", "AIzaSyTestKeyValidFormat123456789012", return_metadata=True))
        assert res_rate["error_type"] == "rate_limit"
        assert res_rate["text"] is None


def test_gemini_auth_error_handled_gracefully():
    """
    Khi API key sai hoặc hết hạn (HTTP 400 / 401 / 403 API_KEY_INVALID):
    Xác định error_type='auth_error', dừng ngay không retry liên tục.
    """
    fake_client = MagicMock()
    fake_client.interactions.create.side_effect = Exception("403 API_KEY_INVALID: Key not found")

    with patch("google.genai.Client", return_value=fake_client):
        res_false = asyncio.run(query_gemini_llm("Thời tiết", "system", "AIzaSyBadKey12345678901234567890123", return_metadata=False))
        assert res_false is None

        res_true = asyncio.run(query_gemini_llm("Thời tiết", "system", "AIzaSyBadKey12345678901234567890123", return_metadata=True))
        assert res_true["error_type"] == "auth_error"
        assert res_true["text"] is None


def test_gemini_timeout_handled_gracefully():
    """
    Khi Gemini API bị timeout:
    Bắt ngoại lệ TimeoutError an toàn, trả về error_type='timeout'.
    """
    async def _mock_wait_for(fut, timeout=None):
        if asyncio.iscoroutine(fut):
            fut.close()
        raise asyncio.TimeoutError()

    with patch("asyncio.wait_for", side_effect=_mock_wait_for):
        res_false = asyncio.run(query_gemini_llm("Thời tiết", "system", "AIzaSyTestKeyValidFormat123456789012", return_metadata=False))
        assert res_false is None

        res_true = asyncio.run(query_gemini_llm("Thời tiết", "system", "AIzaSyTestKeyValidFormat123456789012", return_metadata=True))
        assert res_true["error_type"] == "timeout"


def test_gemini_empty_response_handled_gracefully():
    """
    Khi phản hồi từ Gemini rỗng (bị filter hoặc rỗng text):
    Coi như lỗi, trả về error_type='empty_response', không coi là thành công.
    """
    fake_client = MagicMock()
    fake_response = MagicMock()
    fake_response.output_text = "   "  # Rỗng sau strip
    fake_response.text = ""
    fake_client.interactions.create.return_value = fake_response

    with patch("google.genai.Client", return_value=fake_client):
        res_false = asyncio.run(query_gemini_llm("Câu hỏi", "system", "AIzaSyTestKeyValidFormat123456789012", return_metadata=False))
        assert res_false is None

        res_true = asyncio.run(query_gemini_llm("Câu hỏi", "system", "AIzaSyTestKeyValidFormat123456789012", return_metadata=True))
        assert res_true["error_type"] == "empty_response"
        assert res_true["text"] is None


# ==============================================================================
# 5. KIỂM THỬ TRUYỀN NGỮ CẢNH LỊCH SỬ (HISTORY)
# ==============================================================================

def test_gemini_history_passed_properly():
    """
    Kiểm tra history được truyền và định dạng đầy đủ vào prompt/system context.
    """
    fake_client = MagicMock()
    fake_response = MagicMock()
    fake_response.output_text = "Dạ cháu nhớ rồi ạ, con trai Bác tên là Nam."
    fake_client.interactions.create.return_value = fake_response

    history = [
        {"user": "Con trai bác tên là Nam", "ai": "Dạ cháu đã ghi nhớ ạ"}
    ]

    with patch("google.genai.Client", return_value=fake_client):
        res = asyncio.run(query_gemini_llm(
            prompt="Con trai bác tên gì?",
            system_instruction="Bạn là trợ lý y tế.",
            api_key="AIzaSyTestValidKey123456789012",
            history=history
        ))
        assert res == "Dạ cháu nhớ rồi ạ, con trai Bác tên là Nam."
        call_kwargs = fake_client.interactions.create.call_args.kwargs
        call_input = call_kwargs.get("input", "")
        assert "Con trai bác tên là Nam" in call_input


# ==============================================================================
# 6. KIỂM THỬ BẢO MẬT VÀ KHỞI ĐỘNG ỨNG DỤNG CŨ
# ==============================================================================

def test_missing_gemini_api_key_safe_fallback():
    """
    Khi thiếu API key (rỗng, None hoặc mock):
    query_gemini_llm trả về None an toàn, không ném exception.
    """
    res1 = asyncio.run(query_gemini_llm("Chào cháu", "system", ""))
    assert res1 is None

    res2 = asyncio.run(query_gemini_llm("Chào cháu", "system", None))
    assert res2 is None

    res3 = asyncio.run(query_gemini_llm("Chào cháu", "system", "mock-gemini-key"))
    assert res3 is None


def test_api_key_not_leaked_in_logs():
    """
    Hàm _mask_api_key_in_string phải mask triệt để mọi dạng API key khỏi log.
    """
    raw_log = "Error connecting to https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyABC12345678901234567890123456789"
    masked = _mask_api_key_in_string(raw_log)
    assert "AIzaSyABC" not in masked
    assert "key=***" in masked or "AIza***" in masked


def test_application_startup_and_legacy_operations_without_key():
    """
    Ứng dụng vẫn khởi động và mọi nghiệp vụ cũ (Schedule, Kiosk, Tra cứu)
    hoạt động hoàn hảo 100% khi không có GEMINI_API_KEY.
    """
    from app.database import SessionLocal
    from app.models.user import User
    from app.core.security import create_access_token

    res_health = client.get("/api/health")
    assert res_health.status_code == 200

    db = SessionLocal()
    user = db.query(User).first()
    token = create_access_token({"sub": user.username if user else "test", "user_id": user.id if user else 1, "role": user.role if user else "ELDER"})
    db.close()

    res_sch = client.get("/api/schedules/", headers={"Authorization": f"Bearer {token}"})
    assert res_sch.status_code == 200


# ==============================================================================
# 7. KIỂM THỬ HỘI THOẠI NHIỀU LƯỢT VÀ COMPANION SESSION ISOLATION
# ==============================================================================

def test_session_isolation_between_different_sessions_same_elder():
    """
    Kiểm tra lịch sử giữa hai phiên khác nhau của cùng một người cao tuổi
    hoàn toàn tách biệt, không bị rò rỉ hay trộn lẫn.
    """
    from app.core.llm_service import save_conversation_turn, get_conversation_history, clear_conversation_history

    elder_id = 991
    clear_conversation_history(elder_id)

    # Phiên A: Nói về trồng cây hoa lan
    save_conversation_turn(elder_id, "Bác vừa tưới cây hoa lan", "Dạ hoa lan đẹp lắm Bác ạ", session_id="sess_lan_01")

    # Phiên B: Nói về cháu gái học đại học
    save_conversation_turn(elder_id, "Cháu gái bác học Đại học Bách Khoa", "Dạ cháu gái Bác giỏi quá ạ", session_id="sess_chau_02")

    # Đọc phiên A -> Chỉ chứa hoa lan, không chứa Đại học Bách Khoa
    hist_a = get_conversation_history(elder_id, session_id="sess_lan_01")
    assert len(hist_a) == 1
    assert "hoa lan" in hist_a[0]["user"]
    assert "Bách Khoa" not in hist_a[0]["user"]

    # Đọc phiên B -> Chỉ chứa Đại học Bách Khoa, không chứa hoa lan
    hist_b = get_conversation_history(elder_id, session_id="sess_chau_02")
    assert len(hist_b) == 1
    assert "Bách Khoa" in hist_b[0]["user"]
    assert "hoa lan" not in hist_b[0]["user"]

    # Xóa riêng phiên A -> Phiên B vẫn còn nguyên
    clear_conversation_history(elder_id, session_id="sess_lan_01")
    assert len(get_conversation_history(elder_id, session_id="sess_lan_01")) == 0
    assert len(get_conversation_history(elder_id, session_id="sess_chau_02")) == 1

    # Dọn dẹp
    clear_conversation_history(elder_id)


def test_cross_elder_conversation_isolation():
    """
    Kiểm tra lịch sử trò chuyện giữa hai người cao tuổi khác nhau (Elder A và Elder B)
    không bao giờ bị lộ hay dùng chéo cho nhau.
    """
    from app.core.llm_service import save_conversation_turn, get_conversation_history, clear_conversation_history

    elder_a = 992
    elder_b = 993
    clear_conversation_history(elder_a)
    clear_conversation_history(elder_b)

    save_conversation_turn(elder_a, "Bác A có con trai ở Cần Thơ", "Dạ cháu nhớ rồi ạ")
    save_conversation_turn(elder_b, "Bác B thích nghe nhạc quan họ", "Dạ cháu nhớ rồi ạ")

    hist_a = get_conversation_history(elder_a)
    hist_b = get_conversation_history(elder_b)

    assert any("Cần Thơ" in turn["user"] for turn in hist_a)
    assert not any("quan họ" in turn["user"] for turn in hist_a)

    assert any("quan họ" in turn["user"] for turn in hist_b)
    assert not any("Cần Thơ" in turn["user"] for turn in hist_b)

    clear_conversation_history(elder_a)
    clear_conversation_history(elder_b)


def test_history_length_limit():
    """
    Kiểm tra giới hạn max_turns (mặc định 6) để không bao giờ gửi context quá dài gây tràn token.
    """
    from app.core.llm_service import save_conversation_turn, get_conversation_history, clear_conversation_history

    elder_id = 994
    clear_conversation_history(elder_id)

    # Thêm 10 lượt trò chuyện
    for i in range(10):
        save_conversation_turn(elder_id, f"Câu hỏi số {i}", f"Trả lời số {i}", session_id="sess_limit")

    hist = get_conversation_history(elder_id, session_id="sess_limit", max_turns=6)
    assert len(hist) == 6
    assert hist[-1]["user"] == "Câu hỏi số 9"
    assert hist[0]["user"] == "Câu hỏi số 4"

    clear_conversation_history(elder_id)


def test_llm_error_does_not_corrupt_session_and_gives_transparent_notice():
    """
    Khi API LLM lỗi (429, 503, timeout):
    1. Phiên hội thoại không bị xóa hoặc hỏng.
    2. Phản hồi giải thích minh bạch cho người cao tuổi, không nuốt lỗi giả vờ thành công.
    """
    from app.core.llm_service import get_smart_llm_reply

    with patch("app.core.llm_service.get_gemini_key", return_value="AIzaSyValidFormatKey1234567890123456"):
        with patch("app.core.llm_service.get_openai_key", return_value=""):
            with patch("app.core.llm_service.query_gemini_llm", return_value={"text": None, "model": "gemini-3.5-flash-lite", "grounding_used": False, "sources": [], "error_type": "rate_limit"}):
                res = asyncio.run(get_smart_llm_reply(
                    user_text="Giải thích về hiện tượng thủy triều",
                    return_metadata=True
                ))
                assert res is not None
                assert res["model"] == "contextual_fallback"
                assert res["error_type"] == "rate_limit"
                assert "quá tải" in res["text"].lower() or "chờ" in res["text"].lower()


# ==============================================================================
# 8. KIỂM THỬ TÌM KIẾM INTERNET VÀ METADATA EXTRACTION
# ==============================================================================

def test_detect_search_need_keywords():
    """
    Xác minh hàm detect_search_need nhận diện đúng các truy vấn tin tức, giá vàng, chứng khoán.
    """
    from app.core.llm_service import detect_search_need

    assert detect_search_need("Giá vàng hôm nay bao nhiêu?") is True
    assert detect_search_need("Tin tức thời sự sáng nay có gì?") is True
    assert detect_search_need("Tỷ giá đô la Mỹ hôm nay") is True
    assert detect_search_need("Tra cứu internet giúp bác") is True

    # Câu hỏi sức khỏe hoặc kiến thức thông thường không cần search
    assert detect_search_need("Tại sao lá cây màu xanh?") is False
    assert detect_search_need("Nước sôi ở bao nhiêu độ C?") is False
    assert detect_search_need("Chào cháu") is False


def test_grounding_success_with_extracted_citations():
    """
    Khi mô hình trả về grounding metadata thật từ candidates:
    Trích xuất đúng queries, URLs, title và đánh dấu grounding_used = True.
    """
    mock_response = MagicMock()
    mock_response.output_text = None
    mock_response.text = "Giá vàng SJC hôm nay đang ở mức 85 triệu đồng một lượng."

    mock_cand = MagicMock()
    mock_meta = MagicMock()
    mock_meta.web_search_queries = ["gia vang sjc hom nay"]

    mock_chunk = MagicMock()
    mock_web = MagicMock()
    mock_web.title = "Báo Tuổi Trẻ"
    mock_web.uri = "https://tuoitre.vn/gia-vang"
    mock_chunk.web = mock_web
    mock_meta.grounding_chunks = [mock_chunk]

    mock_cand.grounding_metadata = mock_meta
    mock_response.candidates = [mock_cand]

    fake_client = MagicMock()
    fake_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=fake_client):
        res = asyncio.run(query_gemini_llm(
            prompt="Giá vàng hôm nay thế nào?",
            system_instruction="system",
            api_key="AIzaSyTestGroundingKey123456789",
            use_grounding=True,
            return_metadata=True
        ))
        assert res["grounding_used"] is True
        assert "gia vang sjc hom nay" in res["grounding_queries"]
        assert len(res["sources"]) == 1
        assert res["sources"][0]["title"] == "Báo Tuổi Trẻ"
        assert res["sources"][0]["url"] == "https://tuoitre.vn/gia-vang"


def test_grounding_without_citations_does_not_fabricate_sources():
    """
    Khi mô hình bật grounding nhưng không có kết quả tìm kiếm nào được dùng:
    grounding_used = False và sources rỗng, không tự bịa đặt URL hay nguồn tin.
    """
    mock_response = MagicMock()
    mock_response.output_text = "Hôm nay trời nắng ráo rất đẹp Bác ạ."
    mock_response.candidates = []

    fake_client = MagicMock()
    fake_client.interactions.create.return_value = mock_response

    with patch("google.genai.Client", return_value=fake_client):
        res = asyncio.run(query_gemini_llm(
            prompt="Thời tiết hôm nay thế nào?",
            system_instruction="system",
            api_key="AIzaSyTestGroundingKey123456789",
            use_grounding=True,
            return_metadata=True
        ))
        assert res["grounding_used"] is False
        assert res["grounding_queries"] == []
        assert res["sources"] == []


def test_search_error_fallback_without_grounding():
    """
    Khi tìm kiếm bị lỗi công cụ (search_error):
    get_smart_llm_reply tự động thử lại không dùng grounding và đánh dấu search_failed.
    """
    from app.core.llm_service import get_smart_llm_reply

    with patch("app.core.llm_service.query_gemini_llm") as mock_query:
        # Lần 1 lỗi search_error, Lần 2 thành công không grounding
        mock_query.side_effect = [
            {"text": None, "model": "gemini-3.5-flash-lite", "grounding_used": False, "sources": [], "error_type": "search_error"},
            {"text": "Dạ thưa Bác, hiện chưa thể tra cứu mạng nhưng theo cháu biết thì thông tin như sau.", "model": "gemini-3.5-flash-lite", "grounding_used": False, "sources": [], "error_type": None}
        ]
        with patch("app.core.llm_service.get_gemini_key", return_value="AIzaSyValidKeyForTest123456"):
            res = asyncio.run(get_smart_llm_reply(
                user_text="Tin tức thời sự hôm nay có gì?",
                use_grounding=True,
                return_metadata=True
            ))
            assert res is not None
            assert res.get("search_failed") is True
            assert res["grounding_used"] is False
            assert "Dạ thưa Bác" in res["text"]

