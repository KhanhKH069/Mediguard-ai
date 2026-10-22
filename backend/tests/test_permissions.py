import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.user import User

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_caregiver_permissions_isolation(db_session):
    """
    Kiểm thử bảo mật dữ liệu y tế:
    Người chăm sóc A chỉ được xem đúng người cao tuổi được phân quyền,
    không được xem trộm thông tin của người cao tuổi khác.
    """
    # Tạo 2 cụ già
    elder_A = User(username="elder_a", full_name="Cụ A", hashed_password="pw", role="ELDER")
    elder_B = User(username="elder_b", full_name="Cụ B", hashed_password="pw", role="ELDER")

    # Tạo 2 người chăm sóc
    caregiver_1 = User(username="caregiver_1", full_name="Con Cụ A", hashed_password="pw", role="CAREGIVER")
    caregiver_2 = User(username="caregiver_2", full_name="Con Cụ B", hashed_password="pw", role="CAREGIVER")

    db_session.add_all([elder_A, elder_B, caregiver_1, caregiver_2])
    db_session.commit()

    # Phân quyền: caregiver_1 quản lý elder_A, caregiver_2 quản lý elder_B
    caregiver_1.assigned_elders.append(elder_A)
    caregiver_2.assigned_elders.append(elder_B)
    db_session.commit()

    # Kiểm tra quyền truy cập của caregiver_1
    c1_elders = [e.id for e in caregiver_1.assigned_elders]
    assert elder_A.id in c1_elders
    assert elder_B.id not in c1_elders, "Lỗ hổng: Người chăm sóc 1 xem được Cụ B!"
    assert caregiver_1.can_access_elder(elder_A.id) is True
    assert caregiver_1.can_access_elder(elder_B.id) is False

    # Kiểm tra quyền truy cập của caregiver_2
    c2_elders = [e.id for e in caregiver_2.assigned_elders]
    assert elder_B.id in c2_elders
    assert elder_A.id not in c2_elders, "Lỗ hổng: Người chăm sóc 2 xem được Cụ A!"
    assert caregiver_2.can_access_elder(elder_B.id) is True
    assert caregiver_2.can_access_elder(elder_A.id) is False
