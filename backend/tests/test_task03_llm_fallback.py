import pytest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from app.core.llm_service import (
    get_smart_llm_reply,
    get_smart_contextual_fallback,
    detect_drug_lookup
)
from app.api.drugs import DRUG_DATABASE

client = TestClient(app)


# ==============================================================================
# KIỂM THỬ 1: FALLBACK THÔNG THƯỜNG VẪN HOẠT ĐỘNG
# ==============================================================================
def test_1_normal_fallback_still_works():
    """
    1. Fallback thông thường vẫn hoạt động:
    - Khi LLM offline, các câu hỏi thường (chào hỏi, thời tiết, giải thích khoa học, văn hóa, tâm sự)
      vẫn nhận được phản hồi phù hợp, ấm áp từ bộ não ngữ cảnh.
    - Với câu hỏi mở rộng không có mẫu cố định, trả về thông báo dự phòng thân thiện, ngắn gọn,
      không giả vờ đã gọi thành công LLM.
    """
    # 1.1 Chào hỏi thông thường
    greeting_reply = get_smart_contextual_fallback("Chào cháu nhé", elder_name="Bác Nam")
    assert "chào" in greeting_reply.lower()
    assert "bác nam" in greeting_reply.lower() or "bác" in greeting_reply.lower()

    # 1.2 Thời tiết
    weather_reply = get_smart_contextual_fallback("Hôm nay thời tiết thế nào", elder_name="Bác Lan")
    assert any(w in weather_reply.lower() for w in ["thời tiết", "ngoài trời", "nhiệt độ"])

    # 1.3 Kiến thức phổ thông (khoa học)
    science_reply = get_smart_contextual_fallback("Tại sao lá cây có màu xanh", elder_name="Bác")
    assert any(w in science_reply.lower() for w in ["diệp lục", "quang hợp", "xanh"])

    # 1.4 Câu hỏi mở rộng khi LLM hoàn toàn offline (không có key)
    with patch("app.core.llm_service.get_gemini_key", return_value=""):
        with patch("app.core.llm_service.get_openai_key", return_value=""):
            general_res = asyncio.run(get_smart_llm_reply(
                "Cháu có biết về tháp Eiffel ở Pháp không?",
                elder_name="Bác Bình",
                return_metadata=True
            ))
            assert general_res is not None
            text = general_res["text"]
            assert text is not None
            assert len(text) >= 15
            # Phản hồi dự phòng thân thiện, nói rõ kết nối AI tạm gián đoạn chứ không bịa đặt nội dung
            assert any(w in text.lower() for w in ["gián đoạn", "tạm thời", "chưa thể giải đáp", "nhắc uống thuốc", "thời tiết"])
            # Không giả vờ đã tra cứu thành công
            assert "tháp eiffel được xây dựng vào năm" not in text.lower()


# ==============================================================================
# KIỂM THỬ 2: LLM OFFLINE KHÔNG LÀM CHATBOT CRASH
# ==============================================================================
def test_2_llm_offline_does_not_crash_chatbot():
    """
    2. LLM offline không làm chatbot crash:
    - Khi các nhà cung cấp LLM gặp ngoại lệ (Timeout, RateLimit, 503, AuthError, DNS/Network Error),
      hệ thống xử lý an toàn và trả lời bình thường qua fallback.
    - Cả fast-reply và voice/process đều trả về HTTP 200.
    """
    # 2.1 LLM ném TimeoutError
    async def _mock_wait_for(fut, timeout=None):
        if asyncio.iscoroutine(fut):
            fut.close()
        raise asyncio.TimeoutError()

    with patch("asyncio.wait_for", side_effect=_mock_wait_for):
        with patch("app.core.llm_service.get_gemini_key", return_value="AIzaSyValidFormatKey1234567890123456"):
            reply = asyncio.run(get_smart_llm_reply(
                "Kể chuyện cho bác nghe",
                elder_name="Bác Hùng",
                return_metadata=True
            ))
            assert reply is not None
            assert reply["text"] is not None
            assert reply["error_type"] == "timeout"

    # 2.2 LLM ném ngoại lệ mạng bất ngờ
    with patch("app.core.llm_service.query_gemini_llm", side_effect=ConnectionResetError("Connection reset by peer")):
        with patch("app.core.llm_service.get_gemini_key", return_value="AIzaSyValidFormatKey1234567890123456"):
            with patch("app.core.llm_service.get_openai_key", return_value=""):
                reply_conn = asyncio.run(get_smart_llm_reply(
                    "Trời hôm nay nóng không cháu",
                    elder_name="Bác",
                    return_metadata=True
                ))
                assert reply_conn is not None
                assert reply_conn["text"] is not None
                assert len(reply_conn["text"]) >= 15

    # 2.3 Endpoint /api/ai/fast-reply khi LLM offline hoàn toàn
    with patch("app.core.llm_service.get_gemini_key", return_value=""):
        with patch("app.core.llm_service.get_openai_key", return_value=""):
            res = client.post("/api/ai/fast-reply", json={
                "caller_id": 1,
                "elder_id": 1,
                "message": "Alo cháu có đó không"
            })
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert len(data["reply"]) >= 10

    # 2.4 Endpoint /api/voice/process khi LLM offline hoàn toàn
    with patch("app.core.llm_service.get_gemini_key", return_value=""):
        with patch("app.core.llm_service.get_openai_key", return_value=""):
            res_v = client.post("/api/voice/process", json={
                "elder_id": 1,
                "user_speech": "Cháu ơi hôm nay trời có nắng không"
            })
            assert res_v.status_code == 200
            data_v = res_v.json()
            assert data_v["success"] is True
            assert len(data_v["reply_speech"]) >= 10


# ==============================================================================
# KIỂM THỬ 3: CÂU HỎI THUỐC KHÔNG NHẬN FALLBACK TRÒ CHUYỆN CHUNG CHUNG
# ==============================================================================
def test_3_drug_questions_do_not_receive_generic_chat_fallback():
    """
    3. Câu hỏi thuốc không nhận fallback trò chuyện chung chung:
    - Khi hỏi về thuốc lúc LLM offline, KHÔNG ĐƯỢC trả về câu sáo rỗng
      'cháu luôn ghi nhớ và đồng hành cùng Bác... ăn đồ mềm ấm, uống đủ nước...'.
    - Phải nhận diện và xử lý theo ngữ cảnh thuốc an toàn.
    """
    drug_queries = [
        "Thuốc Panadol dùng để làm gì",
        "Thuốc Amlodipine có tác dụng gì",
        "Tác dụng phụ của thuốc Metformin",
        "Cho tôi biết thuốc bổ phế dùng để làm gì"
    ]
    generic_cliches = [
        "cháu luôn ghi nhớ và đồng hành cùng bác",
        "ăn đồ mềm ấm",
        "uống đủ nước và ngủ đủ giấc",
        "giữ tinh thần lạc quan"
    ]

    for q in drug_queries:
        # Gọi trực tiếp qua fallback function
        reply = get_smart_contextual_fallback(q, elder_name="Bác").lower()
        for cliche in generic_cliches:
            assert cliche not in reply, f"Câu hỏi thuốc '{q}' bị dính fallback sáo rỗng: '{cliche}'"

        # Gọi qua get_smart_llm_reply khi LLM offline
        with patch("app.core.llm_service.get_gemini_key", return_value=""):
            with patch("app.core.llm_service.get_openai_key", return_value=""):
                smart_rep = asyncio.run(get_smart_llm_reply(q, elder_name="Bác"))
                smart_text = str(smart_rep).lower()
                for cliche in generic_cliches:
                    assert cliche not in smart_text, f"Smart reply cho '{q}' bị dính fallback sáo rỗng: '{cliche}'"


# ==============================================================================
# KIỂM THỬ 4: DRUG LOOKUP TRẢ DỮ LIỆU HỢP LỆ THÌ FALLBACK KHÔNG GHI ĐÈ KẾT QUẢ
# ==============================================================================
def test_4_valid_drug_lookup_data_not_overwritten_by_fallback():
    """
    4. Drug lookup trả dữ liệu hợp lệ thì fallback không ghi đè kết quả:
    - Khi luồng gọi chuyển dữ liệu thuốc hợp lệ qua drug_info hoặc intent='DRUG_LOOKUP',
      fallback phải bảo toàn thông tin dược lý chuẩn hóa (chỉ định, hoạt chất, tác dụng phụ).
    - Không ghi đè bằng lời an ủi chung chung.
    """
    # 4.1 Truyền drug_info là dict thông tin chuẩn từ DRUG_DATABASE (Amlodipine)
    amlo_data = next((d for d in DRUG_DATABASE if "amlodipine" in d["id"]), None)
    assert amlo_data is not None

    res_from_fallback = get_smart_contextual_fallback(
        user_text="Thuốc Amlodipine dùng để làm gì",
        elder_name="Bác",
        intent="DRUG_LOOKUP",
        drug_info=amlo_data
    )
    assert "amlodipine" in res_from_fallback.lower()
    assert any(w in res_from_fallback.lower() for w in ["huyết áp", "tim mạch", "mạch vành"])
    assert "cháu luôn ghi nhớ và đồng hành cùng bác" not in res_from_fallback.lower()
    assert "chỉ định" in res_from_fallback.lower() or "bác sĩ" in res_from_fallback.lower()

    # 4.2 Truyền drug_info là chuỗi kết quả đã tra cứu sẵn (pre-formatted lookup string)
    preformatted = "Dạ thưa Bác, thuốc Panadol Extra chứa Paracetamol 500mg giúp giảm đau hạ sốt nhanh chóng."
    res_str = get_smart_contextual_fallback(
        user_text="Thuốc Panadol Extra có tác dụng gì",
        elder_name="Bác",
        intent="DRUG_LOOKUP",
        drug_info=preformatted
    )
    assert res_str == preformatted

    # 4.3 Gọi qua get_smart_llm_reply khi LLM offline với intent=DRUG_LOOKUP và drug_info
    with patch("app.core.llm_service.get_gemini_key", return_value=""):
        res_smart = asyncio.run(get_smart_llm_reply(
            user_text="Amlodipine có tác dụng gì",
            elder_name="Bác",
            intent="DRUG_LOOKUP",
            drug_info=amlo_data
        ))
        assert "amlodipine" in res_smart.lower()
        assert "huyết áp" in res_smart.lower() or "tim mạch" in res_smart.lower()


# ==============================================================================
# KIỂM THỬ 5: KHÔNG CÓ DỮ LIỆU THUỐC THÌ TRẢ THÔNG BÁO CHƯA XÁC MINH
# ==============================================================================
def test_5_no_reliable_drug_data_returns_unverified_notice():
    """
    5. Không có dữ liệu thuốc đáng tin cậy thì trả thông báo chưa xác minh:
    - Khi tra cứu thuốc không có trong nguồn dữ liệu (thuốc lạ, mã thuốc vô nghĩa),
      hoặc khi drug_info=None cho câu hỏi thuốc:
    - Thông báo rõ chưa thể xác minh thông tin.
    - Yêu cầu tên thuốc chính xác hoặc thành phần trên bao bì.
    """
    # 5.1 Thuốc lạ không có trong DRUG_DATABASE qua fallback
    unknown_query = "Thuốc XYZ999 có tác dụng gì"
    rep1 = get_smart_contextual_fallback(unknown_query, elder_name="Bác")
    assert any(phrase in rep1.lower() for phrase in ["chưa thể xác minh", "chưa có thông tin", "chưa có dữ liệu"])
    assert any(phrase in rep1.lower() for phrase in ["tên thuốc chính xác", "thành phần trên bao bì", "bao bì"])

    # 5.2 Tra cứu thuốc với drug_info=None và intent='DRUG_LOOKUP'
    rep2 = get_smart_contextual_fallback(
        "Thuốc lạ ABCD1234",
        elder_name="Bác",
        intent="DRUG_LOOKUP",
        drug_info=None
    )
    assert any(phrase in rep2.lower() for phrase in ["chưa thể xác minh", "chưa có thông tin", "chưa có dữ liệu"])
    assert any(phrase in rep2.lower() for phrase in ["tên thuốc chính xác", "thành phần trên bao bì", "bao bì"])

    # 5.3 Gọi qua /api/ai/fast-reply khi LLM offline hoàn toàn
    with patch("app.core.llm_service.get_gemini_key", return_value=""):
        with patch("app.core.llm_service.get_openai_key", return_value=""):
            res = client.post("/api/ai/fast-reply", json={
                "caller_id": 1,
                "elder_id": 1,
                "message": "Cho tôi biết thuốc UnknownMed404 dùng làm gì"
            })
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["intent"] == "DRUG_LOOKUP"
            reply_text = data["reply"].lower()
            assert any(w in reply_text for w in ["chưa thể xác minh", "chưa có thông tin"])
            assert any(w in reply_text for w in ["tên thuốc chính xác", "thành phần trên bao bì", "bao bì"])


# ==============================================================================
# KIỂM THỬ 6: KHÔNG TỰ SINH LIỀU DÙNG HOẶC HÀNH ĐỘNG SỨC KHỎE
# ==============================================================================
def test_6_no_hallucinated_dosage_or_unsolicited_health_actions():
    """
    6. Không tự sinh liều dùng hoặc hành động sức khỏe:
    - Không tự đưa ra chẩn đoán, chỉ định điều trị hoặc liều thuốc (không tự bịa 'uống 1 viên', 'uống 2 lần/ngày').
    - Không tạo mặc định các bước hành động sức khỏe khi không có dữ liệu (không tự bịa đo huyết áp, uống nước ấm).
    - Không tự tuyên bố đã lưu dữ liệu hoặc gửi thông báo cho người thân.
    """
    # 6.1 Không tự bịa liều dùng khi tra cứu thuốc
    rep_drug = get_smart_contextual_fallback("Thuốc hạ sốt Paracetamol uống mấy viên", elder_name="Bác").lower()
    assert "uống 2 viên mỗi lần" not in rep_drug
    assert "uống 3 viên" not in rep_drug
    assert "uống 4 viên" not in rep_drug

    # 6.2 Câu hỏi kế hoạch hàng ngày khi không có đơn thuốc
    rep_routine = get_smart_contextual_fallback("Hôm nay tôi cần phải làm gì", elder_name="Bác", medications=[]).lower()
    # Không tự tuyên bố đã gửi thông báo an tâm cho con cháu/người thân
    assert "đã gửi thông báo an tâm" not in rep_routine
    assert "đã gửi thông báo cho con cháu" not in rep_routine
    assert "đã gửi thông báo cho người thân" not in rep_routine

    # 6.3 Câu hỏi sức khỏe thông thường không tự đưa ra chẩn đoán hay kê đơn
    rep_health = get_smart_contextual_fallback("Tôi thấy hơi mỏi vai gáy", elder_name="Bác").lower()
    assert "bác bị thoái hóa đốt sống cổ" not in rep_health
    assert "bác hãy uống thuốc" not in rep_health
    assert "kê đơn" not in rep_health