import pytest
from app.core.security import verify_kiosk_pin
from app.models.interaction_log import InteractionLog, EventType, ImmutableLogError
from app.models.medication import Medication
from app.models.schedule import Schedule
from app.models.user import User
from app.database import SessionLocal
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_kiosk_pin_backdoor_removed(monkeypatch):
    import app.core.security as sec
    # Set CAREGIVER_PIN to a custom pin
    monkeypatch.setattr(sec, "CAREGIVER_PIN", "9876")

    assert verify_kiosk_pin("9876") is True
    # The old hardcoded backdoors must now FAIL
    assert verify_kiosk_pin("1234") is False
    assert verify_kiosk_pin("123456") is False
    assert verify_kiosk_pin("0000") is False


def test_elder_cannot_self_verify_schedule():
    from app.core.security import create_access_token
    db = SessionLocal()
    elder = db.query(User).filter(User.role == "ELDER").first()
    cg = db.query(User).filter(User.role == "CAREGIVER").first()
    assert elder is not None and cg is not None
    token_cg = create_access_token({"sub": cg.username, "user_id": cg.id, "role": cg.role})

    # Setting verified_by = elder.id violates self-verification invariant
    payload = {
        "elder_id": elder.id,
        "time_period": "Trưa",
        "target_time": "11:30",
        "verified_by": elder.id,  # SELF-VERIFICATION VIOLATION
        "is_active": True
    }

    response = client.post("/api/schedules/", json=payload, headers={"Authorization": f"Bearer {token_cg}"})
    assert response.status_code == 400
    assert "tự xác minh" in response.json()["detail"].lower()
    db.close()


def test_medication_path_traversal_blocked():
    db = SessionLocal()
    with pytest.raises(ValueError) as excinfo:
        Medication(
            elder_id=1,
            name="Test Path Traversal",
            dosage="1 viên",
            instruction="Uống",
            time_period="Sáng",
            reference_image="../../etc/passwd"
        )
    assert "Đường dẫn ảnh không hợp lệ" in str(excinfo.value)

    # Windows drive absolute path blocked
    with pytest.raises(ValueError) as excinfo:
        Medication(
            elder_id=1,
            name="Test Path Traversal 2",
            dosage="1 viên",
            instruction="Uống",
            time_period="Sáng",
            reference_image="C:/Windows/System32/cmd.exe"
        )
    assert "Đường dẫn ảnh không hợp lệ" in str(excinfo.value)
    db.close()


def test_interaction_log_immutability():
    db = SessionLocal()
    elder = db.query(User).first()
    log = InteractionLog(
        elder_id=elder.id if elder else 1,
        event_type=EventType.DEVICE_RECORDED,
        device_action="CAMERA_SCAN",
        notes="Audit log test"
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # Attempting to mutate log must raise ImmutableLogError
    with pytest.raises(ImmutableLogError):
        log.notes = "Mutated note"
        db.commit()
    db.rollback()

    # Attempting to delete log must raise ImmutableLogError
    with pytest.raises(ImmutableLogError):
        db.delete(log)
        db.commit()
    db.rollback()
    db.close()
