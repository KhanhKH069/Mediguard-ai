import io
import pytest
from fastapi.testclient import TestClient
from main import app
from app.database import SessionLocal
from app.models import Medication, Schedule, User, InteractionLog
from app.core.security import get_password_hash

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_db():
    db = SessionLocal()
    # Check or create test elder and caregiver
    elder = db.query(User).filter(User.username == "test_vision_elder").first()
    if not elder:
        elder = User(
            username="test_vision_elder",
            hashed_password=get_password_hash("pass123"),
            full_name="Bác Test Vision",
            role="ELDER"
        )
        db.add(elder)
        db.commit()
        db.refresh(elder)

    caregiver = db.query(User).filter(User.username == "test_vision_cg").first()
    if not caregiver:
        caregiver = User(
            username="test_vision_cg",
            hashed_password=get_password_hash("pass123"),
            full_name="Chị Test Caregiver",
            role="CAREGIVER"
        )
        db.add(caregiver)
        db.commit()
        db.refresh(caregiver)

    med = db.query(Medication).filter(Medication.name == "Amlodipine 5mg Test").first()
    if not med:
        med = Medication(
            elder_id=elder.id,
            name="Amlodipine 5mg Test",
            dosage="1 viên",
            instruction="Sau khi ăn",
            time_period="Sáng",
            reference_image="ref_amlodipine.jpg",
            is_active=True
        )
        db.add(med)
        db.commit()
        db.refresh(med)

    sch = db.query(Schedule).filter(Schedule.elder_id == elder.id, Schedule.time_period == "Sáng").first()
    if not sch:
        sch = Schedule(
            elder_id=elder.id,
            time_period="Sáng",
            target_time="08:00",
            verified_by=caregiver.id,
            reference_image="ref_amlodipine.jpg",
            compartment_number=1,
            is_active=True
        )
        db.add(sch)
        db.commit()
        db.refresh(sch)

    yield {"elder": elder, "caregiver": caregiver, "med": med, "sch": sch}
    db.close()


def test_verify_pill_success(setup_db):
    med = setup_db["med"]
    sch = setup_db["sch"]

    # Provide a simple test jpeg bytes
    import cv2
    import numpy as np
    img = np.full((100, 100, 3), 200, dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    file_bytes = io.BytesIO(buf.tobytes())

    response = client.post(
        "/api/vision/verify",
        data={
            "medication_id": med.id,
            "schedule_id": sch.id
        },
        files={"file": ("test_pill.jpg", file_bytes, "image/jpeg")}
    )

    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ("MATCHED", "LOW_CONFIDENCE", "MISMATCH")
    assert "confidence_score" in data
    assert data["medication_id"] == med.id


def test_verify_pill_not_found(setup_db):
    img_bytes = io.BytesIO(b"dummy")
    response = client.post(
        "/api/vision/verify",
        data={"medication_id": 999999},
        files={"file": ("test.jpg", img_bytes, "image/jpeg")}
    )
    assert response.status_code == 404


def test_verify_compartment_success(setup_db):
    sch = setup_db["sch"]
    elder = setup_db["elder"]

    import cv2
    import numpy as np
    img = np.full((120, 120, 3), 180, dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    file_bytes = io.BytesIO(buf.tobytes())

    response = client.post(
        "/api/vision/verify-compartment",
        data={
            "schedule_id": sch.id,
            "elder_id": elder.id,
            "elder_speech": "Bác đã uống xong thuốc sáng",
            "send_to_zalo": "false"
        },
        files={"file": ("compartment.jpg", file_bytes, "image/jpeg")}
    )

    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "confidence_score" in data
    assert data["schedule_id"] == sch.id
