import pytest
from pydantic import ValidationError
from app.schemas.schedule import ScheduleCreate

def test_schedule_requires_verified_by():
    """
    Kiểm thử: Lịch dùng thuốc BẮT BUỘC phải có trường verified_by.
    Nếu thiếu trường này, Pydantic Schema phải ném ra lỗi validation ngay lập tức!
    """
    # 1. Thử tạo lịch KHÔNG CÓ verified_by -> Phải báo lỗi
    with pytest.raises(ValidationError) as exc_info:
        ScheduleCreate(
            elder_id=1,
            time_period="Sáng",
            target_time="07:30",
            notes="Đơn thuốc bệnh viện"
            # Thiếu verified_by
        )
    assert "verified_by" in str(exc_info.value), "Lỗi: Hệ thống cho phép tạo lịch mà thiếu người xác minh!"

    # 2. Tạo lịch CÓ verified_by -> Thành công hợp lệ
    sch_valid = ScheduleCreate(
        elder_id=1,
        time_period="Sáng",
        target_time="07:30",
        verified_by=2,
        notes="Bác sĩ BV Bạch Mai duyệt"
    )
    assert sch_valid.verified_by == 2
    assert sch_valid.time_period == "Sáng"
