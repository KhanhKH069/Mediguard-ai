import pytest
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


def test_elder_account_greeting_preserves_name_and_honorific():
    """Tài khoản ELDER (ID 1): Xưng hô 'Bác' phù hợp, giữ nguyên họ tên đã chuẩn hóa"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "caller_id": 1,
        "message": "Chào cháu"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"]
    # Bác Nguyễn Văn Ba được chào với tiền tố Bác và họ tên
    assert "Bác Nguyễn Văn Ba" in reply
    assert "cháu chào bác" in reply.lower()


def test_caregiver_id7_never_called_bac():
    """Tài khoản CAREGIVER ID 7 (Hà Yến Nhi): Tuyệt đối không được gọi là 'Bác Hà Yến Nhi'"""
    # 1. Gọi trực tiếp bằng caller_id = 7
    res = client.post("/api/ai/fast-reply", json={
        "caller_id": 7,
        "message": "Chào bạn"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"]
    assert "Bác Hà Yến Nhi" not in reply
    assert "Bác" not in reply
    assert "Hà Yến Nhi" in reply
    assert "bạn hà yến nhi" in reply.lower()

    # 2. Gọi qua token JWT của user 7
    token = get_token(7)
    res_jwt = client.post(
        "/api/ai/fast-reply",
        json={"message": "Xin chào, tôi cần hỗ trợ"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_jwt.status_code == 200
    data_jwt = res_jwt.json()
    assert "Bác Hà Yến Nhi" not in data_jwt["reply"]
    assert "bạn" in data_jwt["reply"].lower()

    # 3. Khi client cũ truyền elder_id = 7 (thực chất là user_id của caregiver)
    res_legacy = client.post("/api/ai/fast-reply", json={
        "elder_id": 7,
        "message": "Chào cháu"
    })
    assert res_legacy.status_code == 200
    reply_legacy = res_legacy.json()["reply"]
    assert "Bác Hà Yến Nhi" not in reply_legacy
    assert "bạn" in reply_legacy.lower()


def test_caregiver_unauthorized_access_denied_and_no_leak():
    """CAREGIVER ID 7 không được phân quyền cho Elder 1: Không được lấy hoặc làm lộ thông tin"""
    token = get_token(7)
    res = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": 7,
            "elder_id": 1,
            "message": "Hôm nay cụ Ba cần uống những thuốc gì?"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    # Phải có thông báo từ chối quyền truy cập
    assert any(phrase in reply for phrase in ["không có quyền", "chưa được cấp quyền"])
    # Không để lộ danh sách đơn thuốc của cụ Ba
    assert "nguyễn văn ba" not in reply or "quyền truy cập" in reply


def test_caregiver_authorized_access_succeeds_with_correct_addressing():
    """CAREGIVER ID 2 (Nguyễn Văn Nam) có quyền quản lý Elder 1 (Bác Nguyễn Văn Ba):
    Xưng hô với người gọi là 'bạn Nam', và gọi người cao tuổi là 'Bác Nguyễn Văn Ba'"""
    token = get_token(2)
    res = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": 2,
            "elder_id": 1,
            "message": "Bác Ba hôm nay uống thuốc gì rồi?"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"]
    # Không gọi người chăm sóc là Bác Nguyễn Văn Nam
    assert "Bác Nguyễn Văn Nam" not in reply
    # Nhắc đến người cao tuổi một cách kính cẩn
    assert "Bác Nguyễn Văn Ba" in reply or "Bác Ba" in reply or "bác" in reply.lower()


def test_neutral_greeting_when_no_user_info_and_no_default_elder1():
    """Khi không có thông tin người dùng và không truyền elder_id:
    Dùng lời chào trung tính ('bạn'), KHÔNG tự động mặc định elder_id = 1 để nhận vơ là Bác Ba"""
    res = client.post("/api/ai/fast-reply", json={
        "message": "Xin chào"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"]
    # Không tự động chào Bác Nguyễn Văn Ba
    assert "Bác Nguyễn Văn Ba" not in reply
    assert "bạn" in reply.lower()


def test_identity_inquiry_for_caregiver_vs_elder():
    """Kiểm tra câu hỏi danh tính: 'Cháu là ai' / 'Bạn là ai'
    - Với ELDER: xưng cháu, chào Bác
    - Với CAREGIVER: xưng MediGuard AI, chào bạn, không ép xưng cháu/bác
    """
    # ELDER ID 1
    res_elder = client.post("/api/ai/fast-reply", json={
        "caller_id": 1,
        "elder_id": 1,
        "message": "Cháu là ai thế"
    })
    assert res_elder.status_code == 200
    reply_elder = res_elder.json()["reply"]
    assert "Bác Nguyễn Văn Ba" in reply_elder
    assert "cháu" in reply_elder.lower()

    # CAREGIVER ID 7
    res_caregiver = client.post("/api/ai/fast-reply", json={
        "caller_id": 7,
        "message": "Bạn là ai"
    })
    assert res_caregiver.status_code == 200
    reply_caregiver = res_caregiver.json()["reply"]
    assert "Bác Hà Yến Nhi" not in reply_caregiver
    assert "bạn hà yến nhi" in reply_caregiver.lower()
    assert "cháu chào bác" not in reply_caregiver.lower()
