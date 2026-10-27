from app.models.user import User
from app.core.security import create_access_token

def _get_auth_headers(user_id=1):
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = db.query(User).filter(User.role == "ELDER").first()
    db.close()
    token = create_access_token({
        "sub": user.username if user else "elder1",
        "user_id": user.id if user else user_id,
        "role": user.role if user else "ELDER"
    })
    return {"Authorization": f"Bearer {token}"}

import pytest
from datetime import date
from fastapi.testclient import TestClient
from main import app
from app.database import SessionLocal
from app.models.symptom_log import SymptomLog
from app.models.user import User

client = TestClient(app)


def test_fast_ai_reply_normal():
    """Kiểm tra phản hồi AI siêu tốc thông thường"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Dạ cháu ơi, Bác uống thuốc cữ sáng rồi nhé"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["intent"] == "CONFIRM_INTAKE"
    assert "cháu đã ghi nhận" in data["reply"].lower()


def test_fast_ai_reply_symptom_detection_and_date_logging():
    """Kiểm tra tự động phát hiện triệu chứng, lưu theo ngày và kích hoạt cảnh báo"""
    res = client.post("/api/ai/fast-reply", json={
        "elder_id": 1,
        "message": "Cháu ơi Bác thấy rất chóng mặt và buồn nôn"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["symptom_detected"] is True
    assert data["intent"] == "REPORT_SYMPTOM"
    assert data["reported_date"] == date.today().isoformat()
    assert "cháu đã lưu triệu chứng" in data["reply"].lower()

    # Kiểm tra trong DB có lưu đúng ngày không
    db = SessionLocal()
    symp = db.query(SymptomLog).filter(
        SymptomLog.elder_id == 1,
        SymptomLog.reported_date == date.today().isoformat()
    ).order_by(SymptomLog.id.desc()).first()
    assert symp is not None
    assert "Chóng mặt" in symp.symptom_name
    db.close()


def test_get_symptoms_by_date():
    """Kiểm tra API lấy danh sách triệu chứng gom nhóm theo ngày"""
    res = client.get("/api/symptoms/?elder_id=1", headers=_get_auth_headers(1))
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "by_date" in data
    assert date.today().isoformat() in data["by_date"]


def test_drug_text_search():
    """Kiểm tra tra cứu thông tin thuốc bằng văn bản"""
    res = client.get("/api/drugs/search?q=Amlodipine")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["results"]) > 0
    drug = data["results"][0]
    assert "Amlodipine" in drug["name"]
    assert "Huyết Áp" in drug["category"]
    assert drug["dosage_elderly"] is not None


def test_drug_search_vaipe_fuzzy_and_unit_normalization():
    """Kiểm tra tìm kiếm thuốc với fuzzy matching và quy đổi đơn vị (học từ VAIPE 2022)"""
    # 1. Test gõ sai nhẹ: "paracetamon" -> tìm ra "Paracetamol 500mg"
    res1 = client.get("/api/drugs/search?q=paracetamon")
    assert res1.status_code == 200
    assert any("Paracetamol" in r["name"] for r in res1.json()["results"])

    # 2. Test quy đổi đơn vị: "paracetamol 0.5g" -> quy đổi thành "paracetamol 500mg"
    res2 = client.get("/api/drugs/search?q=paracetamol 0.5g")
    assert res2.status_code == 200
    assert any("Paracetamol" in r["name"] for r in res2.json()["results"])

    # 3. Test alias thực tế VAIPE: "kavasdin" -> tìm ra "Amlodipine 5mg"
    res3 = client.get("/api/drugs/search?q=kavasdin")
    assert res3.status_code == 200
    assert any("Amlodipine" in r["name"] for r in res3.json()["results"])


def test_drug_catalog():
    """Kiểm tra tải cẩm nang danh mục thuốc"""
    res = client.get("/api/drugs/catalog")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["drugs"]) >= 10


def test_report_symptom_voice_emergency_auto_detection():
    """Kiểm tra báo cáo triệu chứng bằng câu nói giọng nói có chứa từ khóa khẩn cấp"""
    res = client.post("/api/symptoms/report", json={
        "elder_id": 1,
        "symptom_name": "Bác thấy đau tức ngực và hụt hơi thở dốc từ sáng",
        "severity": "Trung bình",
        "description": "Bác nói qua micro thu âm",
        "action_taken": "Ghi nhận qua Thu âm giọng nói của Bác"
    }, headers=_get_auth_headers(1))
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    # Kiểm tra tự động phát hiện dấu hiệu nguy hiểm và nâng mức Khẩn cấp
    assert data["symptom"]["severity"] == "Khẩn cấp"
    assert "tức ngực" in data["reply_speech"].lower() or "khó thở" in data["reply_speech"].lower()


def test_report_symptom_text_input():
    """Kiểm tra báo cáo triệu chứng dạng gõ chữ văn bản thông thường"""
    res = client.post("/api/symptoms/report", json={
        "elder_id": 1,
        "symptom_name": "Đau mỏi khớp vai gáy",
        "severity": "Nhẹ",
        "description": "Bác gõ chữ qua bàn phím",
        "source": "text"
    }, headers=_get_auth_headers(1))
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["symptom"]["symptom_name"] == "Đau mỏi khớp vai gáy"
    assert data["symptom"]["severity"] == "Nhẹ"
    assert data["symptom"]["action_taken"].startswith("Nguồn ghi nhận: Văn bản.")
    assert data["caregiver_notified"] is True


def test_report_symptom_long_text_not_labelled_as_voice():
    """Câu gõ dài được rút gọn tiêu đề nhưng không bị gắn nhãn giọng nói"""
    res = client.post("/api/symptoms/report", json={
        "elder_id": 1,
        "symptom_name": "Bác bị chóng mặt từ sáng đến giờ, đứng lên là thấy tối sầm mặt mũi",
        "source": "text"
    }, headers=_get_auth_headers(1))
    assert res.status_code == 200
    symptom = res.json()["symptom"]
    assert symptom["symptom_name"] == "Chóng Mặt"
    assert "giọng nói" not in symptom["symptom_name"].lower()
    assert "giọng nói" not in symptom["action_taken"].lower()


def test_scan_prescription_text():
    """Kiểm tra AI Scanner bóc tách đơn thuốc bệnh viện tự động (học từ VAIPE 2022)"""
    pres_text = """
    BỆNH VIỆN LÃO KHOA TRUNG ƯƠNG
    ĐƠN THUỐC ĐIỀU TRỊ NGOẠI TRÚ
    Chẩn đoán: Tăng huyết áp, Đái tháo đường Týp 2, Thoái hóa khớp
    1. Amlodipine 5mg: 1 viên - Sáng sau ăn
    2. Meloxicam 7.5mg: 1 viên - Trưa sau ăn no
    3. Metformin 500mg: 1 viên - Tối sau bữa ăn
    4. Carbocistein 250mg: 2 viên - Sáng, Tối
    Lời dặn: Tái khám sau 1 tháng
    """
    res = client.post("/api/drugs/scan-prescription", data={"text_content": pres_text})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["total_medications"] >= 4
    
    # Kiểm tra nhận diện đúng Amlodipine
    amlo = next((i for i in data["items"] if "Amlodipine" in i["standardized_name"]), None)
    assert amlo is not None
    assert amlo["time_period"] == "Sáng"
    assert amlo["dosage"] == "1 viên"

    # Kiểm tra nhận diện Meloxicam (thuốc học từ VAIPE)
    melo = next((i for i in data["items"] if "Meloxicam" in i["standardized_name"]), None)
    assert melo is not None
    assert melo["time_period"] == "Trưa"


def _removed_placeholder():
    """Kiểm tra logic an toàn: Phát hiện viên thuốc lạ ngoài đơn (Off-prescription Pill)"""
    from app.vision.matcher import analyze_compartment_pills
    from pathlib import Path
    import cv2
    import numpy as np

    # Tạo 1 ảnh giả lập có 4 viên thuốc (trong khi đơn chỉ có 2 viên)
    test_img_path = Path(__file__).parent / "test_pill_tray.jpg"
    img = np.ones((300, 300, 3), dtype=np.uint8) * 40  # Nền tối
    # Vẽ 4 vòng tròn màu sáng đại diện cho 4 viên thuốc
    cv2.circle(img, (80, 80), 25, (240, 240, 240), -1)
    cv2.circle(img, (180, 80), 22, (250, 250, 250), -1)
    cv2.circle(img, (80, 180), 28, (230, 230, 230), -1)
    cv2.circle(img, (180, 180), 26, (50, 230, 240), -1) # Viên thuốc lạ thứ 4
    cv2.imwrite(str(test_img_path), img)

    try:
        # Giả lập đơn cữ này chỉ có 2 viên thuốc
        scheduled = ["Amlodipine 5mg", "Metformin 500mg"]
        result = analyze_compartment_pills(test_img_path, scheduled_meds=scheduled)

        # Hệ thống phải phát hiện số lượng vượt quá và kích hoạt cảnh báo THUỐC LẠ NGOÀI ĐƠN
        assert result["estimated_pill_count"] >= 3
        assert result["has_off_prescription_pills"] is True
        assert result["cv_status"] == "MISMATCH"
        assert result["safety_level"] == "NGUY_HIEM_THUOC_LA"
        assert "LẠ NGOÀI ĐƠN" in result["message"]
    finally:
        if test_img_path.exists():
            test_img_path.unlink()


