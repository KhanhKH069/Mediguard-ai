import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.interaction_log import InteractionLog
from app.models.user import User

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Tạo user mẫu
    elder = User(username="elder_test", full_name="Bác Test", hashed_password="pw", role="ELDER")
    caregiver = User(username="caregiver_test", full_name="Con Test", hashed_password="pw", role="CAREGIVER")
    session.add_all([elder, caregiver])
    session.commit()
    
    yield session
    session.close()

def test_three_independent_states_append_only(db_session):
    """
    Kiểm thử then chốt:
    1. Ba trạng thái (user_responded, device_recorded, caregiver_confirmed)
       phải là các sự kiện RIÊNG BIỆT.
    2. Mỗi sự kiện là 1 dòng riêng trong cơ sở dữ liệu (Append-Only),
       không được ghi đè hay thay thế lẫn nhau!
    """
    elder_id = 1
    schedule_id = 100

    # 1. Phát sinh sự kiện Người cao tuổi phản hồi
    log1 = InteractionLog(
        schedule_id=schedule_id,
        elder_id=elder_id,
        event_type="user_responded",
        response_content="Đã nghe nhắc",
        timestamp=datetime(2026, 10, 22, 7, 5, 0)
    )
    db_session.add(log1)
    db_session.commit()

    # 2. Phát sinh sự kiện Thiết bị/Camera ghi nhận
    log2 = InteractionLog(
        schedule_id=schedule_id,
        elder_id=elder_id,
        event_type="device_recorded",
        device_action="CAMERA_SCAN",
        cv_status="MATCHED",
        timestamp=datetime(2026, 10, 22, 7, 6, 0)
    )
    db_session.add(log2)
    db_session.commit()

    # 3. Phát sinh sự kiện Người thân xác nhận
    log3 = InteractionLog(
        schedule_id=schedule_id,
        elder_id=elder_id,
        event_type="caregiver_confirmed",
        confirmed_by=2,
        notes="Người nhà kiểm tra ảnh và xác nhận đúng thuốc",
        timestamp=datetime(2026, 10, 22, 7, 10, 0)
    )
    db_session.add(log3)
    db_session.commit()

    # Kiểm tra: Cả 3 dòng sự kiện đều tồn tại nguyên vẹn
    all_logs = db_session.query(InteractionLog).filter(InteractionLog.schedule_id == schedule_id).all()
    assert len(all_logs) == 3, "Lỗi: Nhật ký bị ghi đè! Phải có đúng 3 sự kiện độc lập."

    event_types = [l.event_type for l in all_logs]
    assert "user_responded" in event_types
    assert "device_recorded" in event_types
    assert "caregiver_confirmed" in event_types
    assert all_logs[1].cv_status == "MATCHED"
    assert all_logs[2].confirmed_by == 2
