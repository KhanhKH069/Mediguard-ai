import pytest
from fastapi.testclient import TestClient

from main import app
from app.database import SessionLocal
from app.models.user import User, Role
from app.models.medication import Medication
from app.models.schedule import Schedule
from app.core.security import get_password_hash, create_access_token

client = TestClient(app)


@pytest.fixture
def med_access_env():
    """
    Khởi tạo môi trường dữ liệu cách ly phục vụ kiểm thử phân quyền hồ sơ thuốc:
    - 2 Người cao tuổi: elder_a (có thuốc Huyết áp), elder_b (có thuốc Tiểu đường)
    - 1 Người chăm sóc được liên kết với elder_a: cg_linked
    - 1 Người chăm sóc không được liên kết với ai: cg_unlinked
    - 1 Quản trị viên: admin
    """
    db = SessionLocal()

    # Dọn dẹp dữ liệu kiểm thử cũ nếu có
    usernames = ["t2_elder_a", "t2_elder_b", "t2_cg_linked", "t2_cg_unlinked", "t2_admin"]
    existing_users = db.query(User).filter(User.username.in_(usernames)).all()
    user_ids = [u.id for u in existing_users]
    if user_ids:
        db.query(Medication).filter(Medication.elder_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(Schedule).filter(Schedule.elder_id.in_(user_ids)).delete(synchronize_session=False)
        for u in existing_users:
            db.delete(u)
        db.commit()

    elder_a = User(
        username="t2_elder_a",
        full_name="Bác Nguyễn Văn An (75 tuổi)",
        hashed_password=get_password_hash("pass123"),
        role=Role.ELDER
    )
    elder_b = User(
        username="t2_elder_b",
        full_name="Bác Trần Thị Bình (70 tuổi)",
        hashed_password=get_password_hash("pass123"),
        role=Role.ELDER
    )
    cg_linked = User(
        username="t2_cg_linked",
        full_name="Nguyễn Văn Nam (Con trai)",
        hashed_password=get_password_hash("pass123"),
        role=Role.CAREGIVER
    )
    cg_unlinked = User(
        username="t2_cg_unlinked",
        full_name="Hà Yến Nhi (Điều dưỡng)",
        hashed_password=get_password_hash("pass123"),
        role=Role.CAREGIVER
    )
    admin = User(
        username="t2_admin",
        full_name="Admin Hệ Thống",
        hashed_password=get_password_hash("pass123"),
        role=Role.ADMIN
    )

    db.add_all([elder_a, elder_b, cg_linked, cg_unlinked, admin])
    db.commit()
    db.refresh(elder_a)
    db.refresh(elder_b)
    db.refresh(cg_linked)
    db.refresh(cg_unlinked)
    db.refresh(admin)

    # Liên kết: cg_linked -> elder_a
    cg_linked.assigned_elders.append(elder_a)
    db.commit()

    # Thuốc và lịch cho elder_a
    med_a = Medication(
        elder_id=elder_a.id,
        name="Amlodipine 5mg",
        dosage="1 viên",
        instruction="Uống sau ăn sáng",
        time_period="Sáng",
        category="Huyết áp",
        is_active=True
    )
    sch_a = Schedule(
        elder_id=elder_a.id,
        time_period="Sáng",
        target_time="08:00",
        verified_by=cg_linked.id,
        is_active=True
    )

    # Thuốc và lịch cho elder_b
    med_b = Medication(
        elder_id=elder_b.id,
        name="Metformin 500mg",
        dosage="1 viên",
        instruction="Uống sau ăn tối",
        time_period="Tối",
        category="Tiểu đường",
        is_active=True
    )
    sch_b = Schedule(
        elder_id=elder_b.id,
        time_period="Tối",
        target_time="19:00",
        verified_by=admin.id,
        is_active=True
    )

    db.add_all([med_a, sch_a, med_b, sch_b])
    db.commit()
    db.refresh(med_a)
    db.refresh(sch_a)
    db.refresh(med_b)
    db.refresh(sch_b)

    # Sinh JWT tokens
    token_elder_a = create_access_token({"sub": elder_a.username, "user_id": elder_a.id, "role": elder_a.role})
    token_elder_b = create_access_token({"sub": elder_b.username, "user_id": elder_b.id, "role": elder_b.role})
    token_cg_linked = create_access_token({"sub": cg_linked.username, "user_id": cg_linked.id, "role": cg_linked.role})
    token_cg_unlinked = create_access_token({"sub": cg_unlinked.username, "user_id": cg_unlinked.id, "role": cg_unlinked.role})
    token_admin = create_access_token({"sub": admin.username, "user_id": admin.id, "role": admin.role})

    yield {
        "elder_a": elder_a,
        "elder_b": elder_b,
        "cg_linked": cg_linked,
        "cg_unlinked": cg_unlinked,
        "admin": admin,
        "token_elder_a": token_elder_a,
        "token_elder_b": token_elder_b,
        "token_cg_linked": token_cg_linked,
        "token_cg_unlinked": token_cg_unlinked,
        "token_admin": token_admin,
        "med_a": med_a,
        "sch_a": sch_a,
        "med_b": med_b,
        "sch_b": sch_b,
    }

    # Dọn dẹp sau test
    db_clean = SessionLocal()
    clean_users = db_clean.query(User).filter(User.username.in_(usernames)).all()
    clean_ids = [u.id for u in clean_users]
    if clean_ids:
        db_clean.query(Medication).filter(Medication.elder_id.in_(clean_ids)).delete(synchronize_session=False)
        db_clean.query(Schedule).filter(Schedule.elder_id.in_(clean_ids)).delete(synchronize_session=False)
        for u in clean_users:
            db_clean.delete(u)
        db_clean.commit()
    db_clean.close()
    db.close()


# ==============================================================================
# TRƯỜNG HỢP 1: CAREGIVER ĐƯỢC LIÊN KẾT HỢP LỆ -> TRUY CẬP ĐÚNG HỒ SƠ
# ==============================================================================
def test_case_1_linked_caregiver_accesses_valid_elder(med_access_env):
    """
    Caregiver có liên kết hợp lệ (cg_linked -> elder_a):
    - Được truy cập đúng đơn thuốc và lịch của elder_a.
    - Xưng hô với caregiver là 'bạn Nam' (không gọi là 'Bác Nam').
    - Gọi người cao tuổi là 'Bác Nguyễn Văn An' hoặc 'Bác An'.
    - Tuyệt đối không để lộ thuốc của người khác (Metformin của elder_b).
    """
    res = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_linked"].id,
            "elder_id": med_access_env["elder_a"].id,
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"]

    # Chứa đúng thuốc của elder_a
    assert "Amlodipine" in reply
    # Xưng hô chuẩn mực với người chăm sóc
    assert "Bác Nguyễn Văn Nam" not in reply
    assert "bạn" in reply.lower()
    # Nhắc đến người cao tuổi được chăm sóc
    assert "Bác An" in reply or "Bác Nguyễn Văn An" in reply or "bác" in reply.lower()
    # Không để lộ thuốc của người khác
    assert "Metformin" not in reply


# ==============================================================================
# TRƯỜNG HỢP 2: CAREGIVER KHÔNG ĐƯỢC LIÊN KẾT -> BỊ TỪ CHỐI, KHÔNG LỘ DỮ LIỆU
# ==============================================================================
def test_case_2_unlinked_caregiver_denied_access_no_leak(med_access_env):
    """
    Caregiver không được liên kết:
    - cg_unlinked cố tình truy vấn elder_a -> Bị từ chối.
    - cg_linked cố tình truy vấn elder_b (không liên kết) -> Bị từ chối.
    - Tuyệt đối không trả về bất kỳ tên thuốc, liều lượng hay lịch uống nào.
    """
    # 2.1 cg_unlinked truy vấn elder_a
    res1 = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_unlinked"].id,
            "elder_id": med_access_env["elder_a"].id,
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_unlinked']}"}
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["success"] is True
    reply1 = data1["reply"]
    assert "không có quyền" in reply1.lower()
    assert "Amlodipine" not in reply1
    assert "Metformin" not in reply1

    # 2.2 cg_linked cố tình truy vấn chéo sang elder_b
    res2 = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_linked"].id,
            "elder_id": med_access_env["elder_b"].id,
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["success"] is True
    reply2 = data2["reply"]
    assert "không có quyền" in reply2.lower()
    assert "Metformin" not in reply2
    assert "Amlodipine" not in reply2


# ==============================================================================
# TRƯỜNG HỢP 3: CAREGIVER GỬI ID CHÍNH MÌNH LÀM ELDER_ID -> KHÔNG NHẦM VỚI ELDER
# ==============================================================================
def test_case_3_caregiver_sends_own_id_not_confused_with_elder(med_access_env):
    """
    Khi frontend gửi elder_id bằng chính ID của Caregiver:
    - Backend không được nhầm ID người chăm sóc thành hồ sơ người cao tuổi.
    - Trả về thông báo an toàn, hướng dẫn chọn đúng hồ sơ người cao tuổi.
    - Không suy đoán hay tự tiện trả về thuốc của người khác.
    """
    res = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_linked"].id,
            "elder_id": med_access_env["cg_linked"].id,  # Gửi nhầm ID caregiver
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"]

    # Phản hồi an toàn, chỉ rõ đây là tài khoản caregiver
    assert any(phrase in reply.lower() for phrase in ["người chăm sóc", "chọn đúng", "hồ sơ"])
    # Không để lộ đơn thuốc của bất kỳ ai
    assert "Amlodipine" not in reply
    assert "Metformin" not in reply


# ==============================================================================
# TRƯỜNG HỢP 4: THIẾU HOẶC KHÔNG HỢP LỆ THÔNG TIN XÁC THỰC -> KHÔNG CẤP QUYỀN SUY ĐOÁN
# ==============================================================================
def test_case_4_unauthenticated_or_invalid_auth_denied_without_speculation(med_access_env):
    """
    Request không có token hoặc token giả mạo:
    - Không được suy đoán caller là elder chỉ vì body có elder_id = elder_a.id.
    - Không tự động chọn hồ sơ mặc định khi không có thông tin xác thực.
    - Từ chối truy cập và không để lộ dữ liệu đơn thuốc.
    """
    # 4.1 Không có header Authorization, gửi elder_id = elder_a.id
    res_no_auth = client.post(
        "/api/ai/fast-reply",
        json={
            "elder_id": med_access_env["elder_a"].id,
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        }
    )
    assert res_no_auth.status_code == 200
    reply_no_auth = res_no_auth.json()["reply"]
    assert any(phrase in reply_no_auth.lower() for phrase in ["không có quyền", "đăng nhập", "xác thực"])
    assert "Amlodipine" not in reply_no_auth

    # 4.2 Không có header Authorization và không gửi elder_id
    res_anonymous = client.post(
        "/api/ai/fast-reply",
        json={
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        }
    )
    assert res_anonymous.status_code == 200
    reply_anon = res_anonymous.json()["reply"]
    assert any(phrase in reply_anon.lower() for phrase in ["đăng nhập", "chọn hồ sơ", "liên kết"])
    assert "Amlodipine" not in reply_anon
    assert "Metformin" not in reply_anon

    # 4.3 Gửi token giả mạo/không hợp lệ
    res_bad_token = client.post(
        "/api/ai/fast-reply",
        json={
            "elder_id": med_access_env["elder_a"].id,
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        },
        headers={"Authorization": "Bearer forged_invalid_jwt_token_12345"}
    )
    assert res_bad_token.status_code == 200
    reply_bad = res_bad_token.json()["reply"]
    assert any(phrase in reply_bad.lower() for phrase in ["không có quyền", "đăng nhập", "xác thực"])
    assert "Amlodipine" not in reply_bad


# ==============================================================================
# TRƯỜNG HỢP 5: ELDER TRUY CẬP DỮ LIỆU CHÍNH MÌNH HOẠT ĐỘNG HỢP LỆ
# ==============================================================================
def test_case_5_elder_accesses_own_data_legitimately(med_access_env):
    """
    Elder truy cập dữ liệu của chính mình:
    - Có token hợp lệ của elder_a -> Trả về danh mục thuốc của elder_a.
    - Xưng hô 'cháu', chào 'Bác Nguyễn Văn An' hoặc 'Bác An'.
    - Nếu elder_a cố tình gửi elder_id = elder_b.id -> Bị từ chối (IDOR).
    """
    # 5.1 Elder A truy vấn thuốc của chính mình
    res_own = client.post(
        "/api/ai/fast-reply",
        json={
            "elder_id": med_access_env["elder_a"].id,
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_elder_a']}"}
    )
    assert res_own.status_code == 200
    data_own = res_own.json()
    assert data_own["success"] is True
    reply_own = data_own["reply"]

    assert "Amlodipine" in reply_own
    assert "bác" in reply_own.lower()
    assert "Metformin" not in reply_own

    # 5.2 Elder A không truyền elder_id (nhận diện qua token JWT)
    res_jwt_only = client.post(
        "/api/ai/fast-reply",
        json={
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_elder_a']}"}
    )
    assert res_jwt_only.status_code == 200
    assert "Amlodipine" in res_jwt_only.json()["reply"]

    # 5.3 Elder A cố tình gửi elder_id của Elder B (truy cập trái phép chéo)
    res_cross = client.post(
        "/api/ai/fast-reply",
        json={
            "elder_id": med_access_env["elder_b"].id,
            "message": "Cho tôi biết hôm nay tôi cần phải uống thuốc gì"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_elder_a']}"}
    )
    assert res_cross.status_code == 200
    reply_cross = res_cross.json()["reply"]
    assert "không có quyền" in reply_cross.lower()
    assert "Metformin" not in reply_cross


# ==============================================================================
# TRƯỜNG HỢP 6: TRA CỨU THUỐC CỤ THỂ TRONG ĐƠN (SECTION 8.5) & REST ENDPOINTS
# ==============================================================================
def test_case_6_specific_drug_inquiry_and_rest_endpoints(med_access_env):
    """
    Endpoint tra cứu thuốc cụ thể trong đơn (Section 8.5) và REST endpoints:
    - Giữ đúng quy tắc phân quyền như Section 7.
    - Linked caregiver: được tra cứu thông tin đơn thuốc.
    - Unlinked caregiver: bị từ chối, không lộ thông tin đơn thuốc.
    - Unauthenticated: bị từ chối.
    - REST /api/medications/ và /api/schedules/: chặn truy cập trái phép với 403 Forbidden.
    """
    # 6.1 Linked caregiver hỏi thuốc huyết áp trong đơn của elder_a
    res_cg_linked = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_linked"].id,
            "elder_id": med_access_env["elder_a"].id,
            "message": "Bác An uống thuốc huyết áp thế nào"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert res_cg_linked.status_code == 200
    data_cg_linked = res_cg_linked.json()
    assert data_cg_linked["success"] is True
    assert data_cg_linked["intent"] == "INQUIRE_SPECIFIC_DRUG"
    assert "Amlodipine" in data_cg_linked["reply"]

    # 6.2 Unlinked caregiver hỏi thuốc huyết áp trong đơn của elder_a -> Bị từ chối
    res_cg_unlinked = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_unlinked"].id,
            "elder_id": med_access_env["elder_a"].id,
            "message": "Bác An uống thuốc huyết áp thế nào"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_unlinked']}"}
    )
    assert res_cg_unlinked.status_code == 200
    reply_unlinked = res_cg_unlinked.json()["reply"]
    assert "không có quyền" in reply_unlinked.lower()
    assert "Amlodipine" not in reply_unlinked

    # 6.3 Caregiver gửi ID chính mình hỏi thuốc trong đơn
    res_cg_own = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_linked"].id,
            "elder_id": med_access_env["cg_linked"].id,
            "message": "Bác An uống thuốc huyết áp thế nào"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert res_cg_own.status_code == 200
    # Vì trong text có nhắc đích danh 'Bác An' thuộc quyền quản lý, AI nhận diện được elder_a
    assert "Amlodipine" in res_cg_own.json()["reply"]

    # 6.4 Caregiver gửi ID chính mình KHÔNG nhắc tên người cao tuổi
    res_cg_no_name = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_linked"].id,
            "elder_id": med_access_env["cg_linked"].id,
            "message": "Hôm nay uống thuốc huyết áp thế nào"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert res_cg_no_name.status_code == 200
    reply_no_name = res_cg_no_name.json()["reply"]
    assert any(phrase in reply_no_name.lower() for phrase in ["người chăm sóc", "chọn đúng", "hồ sơ"])
    assert "Amlodipine" not in reply_no_name

    # 6.5 REST endpoint /api/medications/ bảo vệ RBAC/IDOR
    r_rest_unlinked = client.get(
        f"/api/medications/?elder_id={med_access_env['elder_a'].id}",
        headers={"Authorization": f"Bearer {med_access_env['token_cg_unlinked']}"}
    )
    assert r_rest_unlinked.status_code == 403

    r_rest_linked = client.get(
        f"/api/medications/?elder_id={med_access_env['elder_a'].id}",
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert r_rest_linked.status_code == 200
    assert any(m["name"] == "Amlodipine 5mg" for m in r_rest_linked.json())

    # 6.6 REST endpoint /api/schedules/ bảo vệ RBAC/IDOR
    r_sch_unlinked = client.get(
        f"/api/schedules/?elder_id={med_access_env['elder_a'].id}",
        headers={"Authorization": f"Bearer {med_access_env['token_cg_unlinked']}"}
    )
    assert r_sch_unlinked.status_code == 403

    r_sch_linked = client.get(
        f"/api/schedules/?elder_id={med_access_env['elder_a'].id}",
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert r_sch_linked.status_code == 200


# ==============================================================================
# TRƯỜNG HỢP 7: TRA CỨU KIẾN THỨC DƯỢC LÝ ĐẠI CHÚNG KHÔNG BỊ ẢNH HƯỞNG
# ==============================================================================
def test_case_7_general_drug_knowledge_lookup_unaffected(med_access_env):
    """
    Tra cứu kiến thức dược lý đại chúng (Section 8: DRUG_LOOKUP) từ DRUG_DATABASE:
    - Hoạt động bình thường mà không đòi hỏi quyền truy cập hồ sơ cá nhân.
    - 'Thuốc Amlodipine dùng để làm gì' trả về thông tin chỉ định điều trị.
    - 'Thuốc Paracetamol có tác dụng gì' trả về công dụng giảm đau, hạ sốt.
    """
    res1 = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["cg_linked"].id,
            "message": "Thuốc Amlodipine dùng để làm gì"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_cg_linked']}"}
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["success"] is True
    assert data1["intent"] == "DRUG_LOOKUP"
    assert any(w in data1["reply"].lower() for w in ["huyết áp", "tim mạch", "mạch vành"])

    res2 = client.post(
        "/api/ai/fast-reply",
        json={
            "caller_id": med_access_env["elder_a"].id,
            "message": "Cho tôi biết công dụng của thuốc Paracetamol"
        },
        headers={"Authorization": f"Bearer {med_access_env['token_elder_a']}"}
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["success"] is True
    assert data2["intent"] == "DRUG_LOOKUP"
    assert any(w in data2["reply"].lower() for w in ["giảm đau", "hạ sốt", "cảm cúm"])
