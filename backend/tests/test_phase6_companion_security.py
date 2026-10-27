import pytest
import json
from pathlib import Path
from fastapi.testclient import TestClient
from main import app
from app.database import SessionLocal
from app.models.user import User, Role
from app.core.security import create_access_token, get_password_hash
from app.config import STORAGE_DIR

client = TestClient(app)
PREFERENCES_FILE = STORAGE_DIR / "companion_preferences.json"
SESSIONS_FILE = STORAGE_DIR / "companion_sessions.json"


@pytest.fixture
def auth_setup():
    """Tạo dữ liệu người dùng và phân quyền phục vụ kiểm thử RBAC"""
    db = SessionLocal()

    # Xóa dữ liệu cũ nếu có
    for u in db.query(User).filter(User.username.in_(["p6_elder_a", "p6_elder_b", "p6_cg_1", "p6_cg_2"])).all():
        db.delete(u)
    db.commit()

    elder_a = User(
        username="p6_elder_a",
        full_name="Bác An",
        hashed_password=get_password_hash("pass123"),
        role=Role.ELDER
    )
    elder_b = User(
        username="p6_elder_b",
        full_name="Bác Bình",
        hashed_password=get_password_hash("pass123"),
        role=Role.ELDER
    )
    caregiver_1 = User(
        username="p6_cg_1",
        full_name="Người chăm sóc 1",
        hashed_password=get_password_hash("pass123"),
        role=Role.CAREGIVER
    )
    caregiver_2 = User(
        username="p6_cg_2",
        full_name="Người chăm sóc 2",
        hashed_password=get_password_hash("pass123"),
        role=Role.CAREGIVER
    )
    db.add_all([elder_a, elder_b, caregiver_1, caregiver_2])
    db.commit()
    db.refresh(elder_a)
    db.refresh(elder_b)
    db.refresh(caregiver_1)
    db.refresh(caregiver_2)

    # Phân quyền: caregiver_1 -> elder_a, caregiver_2 -> elder_b
    caregiver_1.assigned_elders.append(elder_a)
    caregiver_2.assigned_elders.append(elder_b)
    db.commit()

    token_cg1 = create_access_token({"sub": caregiver_1.username, "user_id": caregiver_1.id, "role": caregiver_1.role})
    token_cg2 = create_access_token({"sub": caregiver_2.username, "user_id": caregiver_2.id, "role": caregiver_2.role})
    token_elder_a = create_access_token({"sub": elder_a.username, "user_id": elder_a.id, "role": elder_a.role})

    yield {
        "elder_a": elder_a,
        "elder_b": elder_b,
        "cg1": caregiver_1,
        "cg2": caregiver_2,
        "token_cg1": token_cg1,
        "token_cg2": token_cg2,
        "token_elder_a": token_elder_a,
    }

    # Dọn dẹp sau fixture
    db_clean = SessionLocal()
    for u in db_clean.query(User).filter(User.username.in_(["p6_elder_a", "p6_elder_b", "p6_cg_1", "p6_cg_2"])).all():
        db_clean.delete(u)
    db_clean.commit()
    db_clean.close()
    db.close()


def test_unauthenticated_request_rejected(auth_setup):
    """Yêu cầu không có token hoặc token giả mạo phải bị từ chối với 401"""
    elder_a_id = auth_setup["elder_a"].id

    # Không có header Authorization
    res1 = client.get(f"/api/voice/companion/preferences?elder_id={elder_a_id}")
    assert res1.status_code == 401

    # Token rác / giả mạo
    res2 = client.get(
        f"/api/voice/companion/preferences?elder_id={elder_a_id}",
        headers={"Authorization": "Bearer fake.token.here"}
    )
    assert res2.status_code == 401


def test_caregiver_can_access_assigned_elder_preferences(auth_setup):
    """Người chăm sóc 1 được xem sở thích của người cao tuổi A (được phân quyền)"""
    token_cg1 = auth_setup["token_cg1"]
    elder_a_id = auth_setup["elder_a"].id

    res = client.get(
        f"/api/voice/companion/preferences?elder_id={elder_a_id}",
        headers={"Authorization": f"Bearer {token_cg1}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["elder_id"] == elder_a_id
    assert "preferences" in data


def test_caregiver_cannot_access_unassigned_elder_preferences(auth_setup):
    """Người chăm sóc 1 KHÔNG ĐƯỢC xem sở thích của người cao tuổi B (ngoài phân quyền) -> 403"""
    token_cg1 = auth_setup["token_cg1"]
    elder_b_id = auth_setup["elder_b"].id

    res = client.get(
        f"/api/voice/companion/preferences?elder_id={elder_b_id}",
        headers={"Authorization": f"Bearer {token_cg1}"}
    )
    assert res.status_code == 403
    assert "không có quyền" in res.json()["detail"].lower()


def test_caregiver_can_update_assigned_elder_preferences(auth_setup):
    """Người chăm sóc 1 cập nhật thành công sở thích của người cao tuổi A"""
    token_cg1 = auth_setup["token_cg1"]
    elder_a_id = auth_setup["elder_a"].id

    payload = {
        "elder_id": elder_a_id,
        "preferred_voice": "vi-VN-HoaiMyNeural",
        "speech_rate": "-5%",
        "daily_greeting_enabled": True,
        "reminder_tone": "gentle",
        "favorite_topics": ["sức khỏe", "chuyện vui", "thời tiết"]
    }

    res = client.post(
        "/api/voice/companion/preferences",
        json=payload,
        headers={"Authorization": f"Bearer {token_cg1}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["preferences"]["preferred_voice"] == "vi-VN-HoaiMyNeural"
    assert data["preferences"]["speech_rate"] == "-5%"


def test_caregiver_cannot_update_unassigned_elder_preferences(auth_setup):
    """Người chăm sóc 1 KHÔNG ĐƯỢC sửa sở thích của người cao tuổi B -> 403"""
    token_cg1 = auth_setup["token_cg1"]
    elder_b_id = auth_setup["elder_b"].id

    payload = {
        "elder_id": elder_b_id,
        "preferred_voice": "vi-VN-NamMinhNeural",
        "speech_rate": "+0%"
    }

    res = client.post(
        "/api/voice/companion/preferences",
        json=payload,
        headers={"Authorization": f"Bearer {token_cg1}"}
    )
    assert res.status_code == 403
    assert "không có quyền" in res.json()["detail"].lower()


def test_caregiver_cannot_delete_unassigned_elder_preferences(auth_setup):
    """Người chăm sóc 1 KHÔNG ĐƯỢC xóa sở thích của người cao tuổi B -> 403"""
    token_cg1 = auth_setup["token_cg1"]
    elder_b_id = auth_setup["elder_b"].id

    res = client.delete(
        f"/api/voice/companion/preferences?elder_id={elder_b_id}",
        headers={"Authorization": f"Bearer {token_cg1}"}
    )
    assert res.status_code == 403
    assert "không có quyền" in res.json()["detail"].lower()


def test_caregiver_cannot_clear_unassigned_elder_session(auth_setup):
    """Người chăm sóc 1 KHÔNG ĐƯỢC xóa phiên của người cao tuổi B -> 403"""
    token_cg1 = auth_setup["token_cg1"]
    elder_b_id = auth_setup["elder_b"].id

    res = client.delete(
        f"/api/voice/companion/session/{elder_b_id}",
        headers={"Authorization": f"Bearer {token_cg1}"}
    )
    assert res.status_code == 403
    assert "không có quyền" in res.json()["detail"].lower()


def test_cross_elder_data_isolation(auth_setup):
    """Đảm bảo không có rò rỉ hoặc truy cập chéo dữ liệu giữa hai người cao tuổi"""
    token_cg1 = auth_setup["token_cg1"]
    token_cg2 = auth_setup["token_cg2"]
    elder_a_id = auth_setup["elder_a"].id
    elder_b_id = auth_setup["elder_b"].id

    # CG1 cập nhật sở thích cho Elder A
    client.post(
        "/api/voice/companion/preferences",
        json={
            "elder_id": elder_a_id,
            "preferred_voice": "vi-VN-HoaiMyNeural",
            "custom_notes": "Ghi chú bảo mật riêng của Cụ A"
        },
        headers={"Authorization": f"Bearer {token_cg1}"}
    )

    # CG2 kiểm tra sở thích của Elder B -> không chứa ghi chú của Cụ A
    res_b = client.get(
        f"/api/voice/companion/preferences?elder_id={elder_b_id}",
        headers={"Authorization": f"Bearer {token_cg2}"}
    )
    assert res_b.status_code == 200
    prefs_b = res_b.json()["preferences"]
    assert prefs_b.get("custom_notes") != "Ghi chú bảo mật riêng của Cụ A"


def test_corrupted_json_storage_handled_gracefully(auth_setup):
    """Dữ liệu JSON trong file bị thiếu hoặc hỏng định dạng không làm crash API"""
    token_cg1 = auth_setup["token_cg1"]
    elder_a_id = auth_setup["elder_a"].id

    # Ghi file JSON bị lỗi cú pháp
    PREFERENCES_FILE.write_text("{malformed: json content...!!!", encoding="utf-8")

    # API vẫn trả về an toàn, không ném 500
    res = client.get(
        f"/api/voice/companion/preferences?elder_id={elder_a_id}",
        headers={"Authorization": f"Bearer {token_cg1}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "preferences" in data


def test_api_error_does_not_leak_sensitive_info(auth_setup):
    """Lỗi API không để lộ thông tin nhạy cảm hay đường dẫn hệ điều hành"""
    token_cg1 = auth_setup["token_cg1"]

    # Thử ID người cao tuổi không tồn tại
    res = client.get(
        "/api/voice/companion/preferences?elder_id=99999",
        headers={"Authorization": f"Bearer {token_cg1}"}
    )
    # 403 hoặc 404
    assert res.status_code in [403, 404]
    detail = str(res.json().get("detail", ""))
    assert "C:\\" not in detail
    assert "token" not in detail.lower()
    assert "password" not in detail.lower()
