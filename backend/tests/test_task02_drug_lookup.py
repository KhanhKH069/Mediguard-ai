import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from app.database import SessionLocal
from app.models.user import User, Role
from app.core.security import create_access_token

client = TestClient(app)


def get_token(user_id: int) -> str:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        return create_access_token({
            "sub": user.username,
            "user_id": user.id,
            "role": user.role
        })
    finally:
        db.close()


# ==============================================================================
# TRƯỜNG HỢP 1: CÂU HỎI "THUỐC BỔ PHẾ DÙNG ĐỂ LÀM GÌ?"
# ==============================================================================
def test_1_bo_phe_product_group_distinction():
    """
    1. 'Thuốc bổ phế dùng để làm gì?':
    - Phân biệt đây là nhóm sản phẩm/thuốc thảo dược bổ phế, giảm ho chứ không phải tên 1 thuốc đơn lẻ.
    - Đưa ra mô tả khái quát (nhuận phế, bổ phổi, giảm ho).
    - Đề nghị cung cấp tên đầy đủ, nhà sản xuất hoặc gửi ảnh bao bì.
    - Không trả về câu fallback sáo rỗng.
    """
    queries = [
        "Cho tôi biết thuốc bổ phế dùng để làm gì",
        "Thuốc bổ phế dùng để làm gì",
        "Bổ phế dùng để làm gì?"
    ]
    for q in queries:
        res = client.post("/api/ai/fast-reply", json={
            "caller_id": 1,
            "elder_id": 1,
            "message": q
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["intent"] == "DRUG_LOOKUP"
        reply = data["reply"]

        # Phân biệt nhóm sản phẩm thảo dược / siro
        assert any(w in reply.lower() for w in ["nhóm sản phẩm", "tên gọi chung", "chế phẩm"])
        # Mô tả khái quát công dụng
        assert any(w in reply.lower() for w in ["bổ phổi", "nhuận phế", "giảm ho", "đường hô hấp"])
        # Đề nghị xác định rõ sản phẩm / chụp ảnh bao bì
        assert any(w in reply.lower() for w in ["tên đầy đủ", "nhà sản xuất", "bao bì", "vỏ hộp"])
        # Không bị rơi vào câu fallback sáo rỗng
        assert "cháu luôn ghi nhớ và đồng hành cùng bác" not in reply.lower()


# ==============================================================================
# TRƯỜNG HỢP 2: TÊN THUỐC CÓ TRONG CƠ SỞ DỮ LIỆU (DRUG_DATABASE)
# ==============================================================================
def test_2_drug_in_database_amlodipine_and_paracetamol():
    """
    2. Tên thuốc có trong cơ sở dữ liệu:
    - Trả lời trực tiếp vào công dụng điều trị từ dữ liệu chuẩn hóa của DRUG_DATABASE.
    - Nêu đúng nhóm dược lý và chỉ định điều trị.
    - Không bịa đặt chỉ định điều trị cá nhân.
    """
    # 2.1 Amlodipine
    res = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Thuốc Amlodipine dùng để làm gì"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["intent"] == "DRUG_LOOKUP"
    assert data["drug_info"] is not None
    assert "amlodipine" in data["drug_info"]["id"].lower()
    reply = data["reply"]
    assert "huyết áp" in reply.lower() or "tim mạch" in reply.lower()
    assert any(w in reply.lower() for w in ["tăng huyết áp", "đau thắt ngực", "mạch vành", "tai biến"])
    assert "chỉ định" in reply.lower() or "bác sĩ" in reply.lower()

    # 2.2 Paracetamol
    res2 = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Cho tôi biết công dụng của thuốc Paracetamol"
    })
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["success"] is True
    assert data2["intent"] == "DRUG_LOOKUP"
    reply2 = data2["reply"].lower()
    assert any(w in reply2 for w in ["giảm đau", "hạ sốt", "cảm cúm"])


# ==============================================================================
# TRƯỜNG HỢP 3: TÊN THUỐC KHÔNG CÓ TRONG CƠ SỞ DỮ LIỆU
# ==============================================================================
def test_3_drug_not_in_database():
    """
    3. Tên thuốc không có trong cơ sở dữ liệu:
    - Không tự bịa bản ghi hoặc công dụng.
    - Thông báo rõ cẩm nang chuẩn hóa chưa có thông tin về thuốc này.
    - Hỏi tên đầy đủ, hoạt chất hoặc đề nghị gửi ảnh bao bì.
    """
    res = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Thuốc Boganic dùng để làm gì"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["intent"] == "DRUG_LOOKUP"
    assert data["drug_info"] is None
    reply = data["reply"]
    # Không bịa công dụng, nói rõ chưa có thông tin
    assert any(w in reply.lower() for w in ["chưa có thông tin", "chưa có trong cẩm nang", "chưa ghi nhận"])
    # Yêu cầu gửi ảnh hoặc cung cấp thêm thông tin
    assert any(w in reply.lower() for w in ["bao bì", "vỏ hộp", "vỉ thuốc", "hoạt chất", "nhà sản xuất"])


# ==============================================================================
# TRƯỜNG HỢP 4: CÂU HỎI VỀ TÁC DỤNG PHỤ CỦA THUỐC
# ==============================================================================
def test_4_drug_side_effects_inquiry():
    """
    4. Câu hỏi về tác dụng phụ:
    - Trích xuất đúng trường side_effects từ DRUG_DATABASE.
    - Khuyên người bệnh báo cho người nhà/bác sĩ nếu gặp bất thường.
    """
    res = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Thuốc Amlodipine có tác dụng phụ gì"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["intent"] == "DRUG_LOOKUP"
    reply = data["reply"].lower()
    # Amlodipine side effects: phù cổ chân, đỏ bừng mặt, nhức đầu
    assert any(w in reply for w in ["phù", "cổ chân", "đỏ bừng", "nhức đầu", "tác dụng phụ"])
    assert any(w in reply for w in ["bác sĩ", "người nhà", "kiểm tra"])


# ==============================================================================
# TRƯỜNG HỢP 5: CÂU HỎI VỀ LỊCH UỐNG THUỐC CÁ NHÂN
# ==============================================================================
def test_5_personal_schedule_inquiry_not_hijacked():
    """
    5. Câu hỏi về lịch uống thuốc cá nhân:
    - Router KHÔNG được bắt nhầm sang tra cứu thuốc chung.
    - Phải đi vào nhánh INQUIRE_MEDICATION / INQUIRE_DAILY_ROUTINE của cá nhân.
    """
    # 5.1 Hỏi lịch uống thuốc
    res1 = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Hôm nay tôi uống thuốc gì"
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["intent"] == "INQUIRE_MEDICATION"
    assert "danh mục thuốc" in data1["reply"].lower() or "lịch uống thuốc" in data1["reply"].lower()

    # 5.2 Hỏi giờ uống thuốc
    res2 = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Mấy giờ uống thuốc cữ trưa"
    })
    assert res2.status_code == 200
    assert res2.json()["intent"] == "INQUIRE_MEDICATION"


# ==============================================================================
# TRƯỜNG HỢP 6: CÂU HỎI KHÔNG LIÊN QUAN ĐẾN THUỐC
# ==============================================================================
def test_6_unrelated_questions_not_hijacked():
    """
    6. Câu hỏi không liên quan đến thuốc:
    - Thời tiết, thời gian, tâm sự, kiến thức phổ thông không bị router thuốc can thiệp.
    """
    # 6.1 Thời gian
    res_time = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Bây giờ là mấy giờ rồi cháu"
    })
    assert res_time.status_code == 200
    assert res_time.json()["intent"] == "INQUIRE_TIME"

    # 6.2 Kiến thức phổ thông
    res_know = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Tại sao lá cây lại có màu xanh hả cháu"
    })
    assert res_know.status_code == 200
    assert res_know.json()["intent"] in ["AI_LLM_CONSULTATION", "COMPANION_CHAT"]


# ==============================================================================
# TRƯỜNG HỢP 7: DỮ LIỆU TRA CỨU TRỐNG HOẶC PHÁT SINH LỖI DỊCH VỤ
# ==============================================================================
def test_7_drug_lookup_service_error_handling():
    """
    7. Dịch vụ tra cứu phát sinh lỗi:
    - Không làm crash endpoint chat (vẫn trả về 200 OK an toàn).
    - Không thông báo thành công giả tạo hoặc bịa dữ liệu.
    - Trả lời rõ ràng hệ thống tạm thời gặp gián đoạn.
    """
    with patch("app.api.ai.search_drugs", side_effect=Exception("Database connection timeout")):
        res = client.post("/api/ai/fast-reply", json={
            "caller_id": 1,
            "elder_id": 1,
            "message": "Thuốc Amlodipine dùng để làm gì"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["intent"] == "DRUG_LOOKUP"
        reply = data["reply"]
        assert any(w in reply.lower() for w in ["gián đoạn", "sự cố", "thử lại sau", "tạm thời"])
        # Không trả về kết quả giả mạo
        assert data["drug_info"] is None


# ==============================================================================
# TRƯỜNG HỢP 8: NGƯỜI DÙNG KHÔNG ĐƯỢC PHÂN QUYỀN KHÔNG THỂ ĐỌC ĐƠN THUỐC NGƯỜI KHÁC
# ==============================================================================
def test_8_unauthorized_caregiver_cannot_read_elder_prescription():
    """
    8. Caregiver ID 7 không có quyền với Elder 1:
    - Bị từ chối khi hỏi về đơn thuốc của Elder 1.
    - Không để rò rỉ thông tin danh mục thuốc của Elder 1.
    """
    token_cg7 = get_token(7)
    res = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": 7,
            "elder_id": 1,
            "message": "Hôm nay cụ Ba cần uống những thuốc gì?"
        },
        headers={"Authorization": f"Bearer {token_cg7}"}
    )
    assert res.status_code == 200
    data = res.json()
    reply = data["reply"].lower()
    assert any(phrase in reply for phrase in ["không có quyền", "chưa được cấp quyền"])
    assert "bác hà yến nhi" not in reply


# ==============================================================================
# TRƯỜNG HỢP 9: KHÔNG TẠO RA LIỀU DÙNG HOẶC CÔNG DỤNG KHÔNG CÓ TRONG NGUỒN DỮ LIỆU
# ==============================================================================
def test_9_no_hallucinated_dosage_or_indications():
    """
    9. Không tự tạo ra liều dùng hoặc công dụng bịa đặt:
    - Khi tra cứu thuốc không có trong DB, không được điền '1 viên/ngày' hay công dụng giả.
    - Khi tra cứu thuốc có trong DB, không biến cẩm nang thành chỉ định điều trị cá nhân ép buộc.
    """
    # Thuốc lạ không có trong từ điển
    res = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Thuốc XYZ999 có tác dụng gì"
    })
    assert res.status_code == 200
    reply = res.json()["reply"].lower()
    # Không tự bịa liều dùng
    assert "uống 1 viên" not in reply
    assert "uống 2 viên" not in reply
    assert "chưa có thông tin" in reply or "chưa có trong cẩm nang" in reply


# ==============================================================================
# TRƯỜNG HỢP 10: KHÔNG TRẢ VỀ CÂU FALLBACK SÁO RỖNG KHI LLM OFFLINE
# ==============================================================================
def test_10_no_companion_fallback_for_drug_lookup_when_llm_offline():
    """
    10. Không trả về câu 'cháu luôn ghi nhớ và đồng hành cùng Bác' cho câu hỏi tra cứu thuốc:
    - Dù LLM hoàn toàn offline hoặc hết quota, router thuốc phải tự giải quyết.
    """
    with patch("app.core.llm_service.get_smart_llm_reply", return_value=None):
        res = client.post("/api/ai/fast-reply", json={
            "caller_id": 1,
            "elder_id": 1,
            "message": "Cho tôi biết thuốc bổ phế dùng để làm gì"
        })
        assert res.status_code == 200
        reply = res.json()["reply"]
        assert "cháu luôn ghi nhớ và đồng hành cùng bác" not in reply.lower()
        assert "bổ phế" in reply.lower()
        assert any(w in reply.lower() for w in ["nhuận phế", "bổ phổi", "giảm ho"])
