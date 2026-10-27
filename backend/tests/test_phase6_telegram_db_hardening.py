import pytest
import uuid
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from main import app
from app.database import SessionLocal
from app.models.symptom_log import SymptomLog
from app.models.interaction_log import InteractionLog
from app.models.schedule import Schedule
from app.models.user import User

client = TestClient(app)


def test_telegram_alert_returns_false_does_not_lose_business_logs():
    """
    KHI send_telegram_alert TRẢ VỀ FALSE:
    - Log nghiệp vụ (SymptomLog và InteractionLog) vẫn được lưu và commit độc lập.
    - caregiver_notified phải là False, tuyệt đối không được báo khống là True.
    - Response vẫn thành công 200 với thông điệp an toàn.
    """
    db = SessionLocal()
    unique_speech = f"Bác bị đau thắt ngực dữ dội nhức buốt {uuid.uuid4().hex[:6]}"

    with patch("app.api.voice.send_telegram_alert", new_callable=AsyncMock) as mock_tele:
        mock_tele.return_value = False

        res = client.post("/api/voice/process", json={
            "user_speech": unique_speech,
            "elder_id": 1
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["action"] == "EMERGENCY_ALERT"

        # Kiểm tra SymptomLog trong DB
        symp = db.query(SymptomLog).filter(
            SymptomLog.description.contains(unique_speech)
        ).order_by(SymptomLog.id.desc()).first()
        assert symp is not None, "Log nghiệp vụ SymptomLog bị mất khi Telegram trả về False!"
        assert symp.caregiver_notified is False, "Hệ thống báo khống caregiver_notified=True khi Telegram thất bại!"
        assert "chưa gửi được" in symp.action_taken.lower() or "thất bại" in symp.action_taken.lower()

        # Kiểm tra InteractionLog trong DB
        audit = db.query(InteractionLog).filter(
            InteractionLog.response_content == unique_speech
        ).order_by(InteractionLog.id.desc()).first()
        assert audit is not None, "Log nghiệp vụ InteractionLog bị mất khi Telegram trả về False!"
        assert "thất bại" in audit.notes.lower()

    db.close()


def test_telegram_alert_exception_does_not_crash_and_persists_logs():
    """
    KHI send_telegram_alert NÉM EXCEPTION:
    - Không làm sập ứng dụng (không ném lỗi 500).
    - Log nghiệp vụ vẫn được lưu trữ và commit độc lập vào cơ sở dữ liệu.
    - caregiver_notified phải là False.
    """
    db = SessionLocal()
    unique_speech = f"Bác uống nhầm thuốc sâu rồi cứu bác với {uuid.uuid4().hex[:6]}"

    with patch("app.api.voice.send_telegram_alert", new_callable=AsyncMock) as mock_tele:
        mock_tele.side_effect = RuntimeError("Telegram Network Timeout Gateway Error")

        res = client.post("/api/voice/process", json={
            "user_speech": unique_speech,
            "elder_id": 1
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["action"] == "EMERGENCY_ALERT"

        symp = db.query(SymptomLog).filter(
            SymptomLog.description.contains(unique_speech)
        ).order_by(SymptomLog.id.desc()).first()
        assert symp is not None, "Log SymptomLog bị mất khi Telegram ném ngoại lệ!"
        assert symp.caregiver_notified is False, "caregiver_notified không được là True khi Telegram gặp ngoại lệ!"

        audit = db.query(InteractionLog).filter(
            InteractionLog.response_content == unique_speech
        ).order_by(InteractionLog.id.desc()).first()
        assert audit is not None, "Log InteractionLog bị mất khi Telegram ném ngoại lệ!"

    db.close()


def test_database_error_rolls_back_cleanly_without_unhandled_crash():
    """
    KHI DATABASE GẶP LỖI (VÍ DỤ COMMIT BỊ LỖI):
    - Hệ thống rollback transaction sạch sẽ, không làm hỏng session.
    - API vẫn hoàn tất phản hồi nghiệp vụ cho người dùng một cách an toàn.
    """
    with patch("app.api.voice.send_telegram_alert", new_callable=AsyncMock) as mock_tele:
        mock_tele.return_value = True

        with patch("sqlalchemy.orm.Session.commit", side_effect=Exception("Database lock error")):
            res = client.post("/api/voice/process", json={
                "user_speech": f"Bác bị khó thở quá {uuid.uuid4().hex[:6]}",
                "elder_id": 1
            })
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert "reply_speech" in data


def test_retry_deduplication_within_short_window():
    """
    CHỐNG GHI LOG TRÙNG KHI RETRY:
    - Khi client gọi lại request cấp cứu trong vòng 5 giây, hệ thống không tạo thêm log trùng lặp.
    """
    db = SessionLocal()
    unique_speech = f"Bác vừa bị té ngã đau đớn không đứng dậy được {uuid.uuid4().hex[:6]}"

    with patch("app.api.voice.send_telegram_alert", new_callable=AsyncMock) as mock_tele:
        mock_tele.return_value = True

        # Gọi lần 1
        res1 = client.post("/api/voice/process", json={
            "user_speech": unique_speech,
            "elder_id": 1
        })
        assert res1.status_code == 200

        count_after_first = db.query(InteractionLog).filter(
            InteractionLog.response_content == unique_speech
        ).count()
        assert count_after_first == 1

        # Gọi lần 2 ngay lập tức (retry)
        res2 = client.post("/api/voice/process", json={
            "user_speech": unique_speech,
            "elder_id": 1
        })
        assert res2.status_code == 200

        count_after_second = db.query(InteractionLog).filter(
            InteractionLog.response_content == unique_speech
        ).count()
        assert count_after_second == 1, "Log bị ghi trùng khi client gửi lại trong khoảng thời gian ngắn!"

    db.close()
