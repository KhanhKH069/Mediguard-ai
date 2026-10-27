# ==============================================================================
# MEDIGUARD CARE - PATIENT API ENDPOINTS
# Manage discharged patients, enrollment in protocols, and longitudinal timelines
# ==============================================================================

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, date

router = APIRouter()

# Bộ nhớ giả lập phục vụ API (In-memory Mock Store)
MOCK_PATIENT_STORE = [
    {
        "id": "PT-2026-0891",
        "full_name": "Nguyễn Văn Tuấn",
        "age": 48,
        "gender": "Nam",
        "phone_number": "0912 345 678",
        "icd10_code": "K80.2",
        "procedure_name": "Phẫu thuật Cắt túi mật nội soi",
        "surgical_department": "Ngoại Tiêu hóa - Gan Mật",
        "primary_surgeon_name": "BS. CKII Lê Hoàng Tuấn",
        "assigned_coordinator_nurse": "ĐD. CKI Nguyễn Thu Hằng",
        "discharge_date": "2026-10-20",
        "current_day": "D+3",
        "current_triage": "ORANGE",
        "consent_voice_monitoring": True,
        "history": [
            {
                "day": "D+1",
                "date": "2026-10-21",
                "pain_vas": 4,
                "temperature": 36.8,
                "triage": "GREEN",
                "verbatim": "Vết mổ hơi nhức một chút khi ho, tôi đã đi lại nhẹ được."
            },
            {
                "day": "D+3",
                "date": "2026-10-23",
                "pain_vas": 6,
                "temperature": 37.8,
                "triage": "ORANGE",
                "verbatim": "Từ sáng đến giờ vết mổ hơi đau nhói hơn hôm qua, người thấy mệt và hơi âm ấm đầu 37.8 độ."
            }
        ]
    },
    {
        "id": "PT-2026-0422",
        "full_name": "Vũ Đình Khang",
        "age": 62,
        "gender": "Nam",
        "phone_number": "0983 892 114",
        "icd10_code": "I25.1",
        "procedure_name": "Nong và đặt Stent động mạch vành LAD",
        "surgical_department": "Tim mạch Can thiệp",
        "primary_surgeon_name": "TS. BS. Vũ Quốc Doanh",
        "assigned_coordinator_nurse": "ĐD. Đặng Thanh Tâm",
        "discharge_date": "2026-10-22",
        "current_day": "D+1",
        "current_triage": "RED",
        "consent_voice_monitoring": True,
        "history": [
            {
                "day": "D+1",
                "date": "2026-10-23",
                "pain_vas": 8,
                "temperature": 36.5,
                "triage": "RED",
                "verbatim": "Tôi thấy tức nghẹn ngực trái lan ra vai khoảng 20 phút nay, thở hơi dốc và vã mồ hôi hột..."
            }
        ]
    }
]


@router.get("/patients")
async def list_patients(
    department: Optional[str] = Query(None),
    triage_level: Optional[str] = Query(None)
):
    """
    Lấy danh sách bệnh nhân xuất viện theo dõi, có thể lọc theo chuyên khoa hoặc mức Triage
    """
    results = MOCK_PATIENT_STORE
    if department:
        results = [p for p in results if p["surgical_department"] == department]
    if triage_level:
        results = [p for p in results if p["current_triage"] == triage_level]
    return results


@router.get("/patients/{patient_id}")
async def get_patient_detail(patient_id: str):
    """
    Chi tiết hồ sơ bệnh nhân kèm toàn bộ dòng thời gian phục hồi qua các ngày
    """
    patient = next((p for p in MOCK_PATIENT_STORE if p["id"] == patient_id), None)
    if not patient:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh nhân")
    return patient
