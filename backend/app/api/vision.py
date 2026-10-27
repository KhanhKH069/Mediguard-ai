from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Medication, Schedule, InteractionLog, User
from app.models.interaction_log import EventType, CvStatus
from app.config import UPLOAD_IMG_DIR
from app.vision.preprocessor import save_upload_temp
from app.vision.matcher import verify_pill_image, resolve_reference_image_filename
from app.core.notifier import alert_caregiver
from app.core.zalo_service import zalo_service
from app.api.websocket import notify_realtime_update

router = APIRouter(prefix="/api/vision", tags=["Computer Vision - Pill Verification"])


@router.post("/verify")
async def verify_pill(
    medication_id: int = Form(...),
    schedule_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Nhận ảnh chụp viên thuốc và đối chiếu với mẫu tham chiếu của thuốc được chọn.
    Trả về đúng 3 trạng thái an toàn:
    - MATCHED: Phù hợp trong phạm vi kiểm tra
    - LOW_CONFIDENCE: Chưa đủ độ tin cậy, cần người chăm sóc kiểm tra
    - MISMATCH: Không khớp với mẫu tham chiếu, vui lòng kiểm tra lại
    """
    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin thuốc")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File ảnh tải lên rỗng")

    try:
        temp_path = save_upload_temp(file_bytes, UPLOAD_IMG_DIR, file.filename or "pill.jpg")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    # Xác định ảnh mẫu từ thuốc hoặc từ lịch uống thuốc hoặc từ tên thuốc
    ref_filename = med.reference_image
    sch = None
    if schedule_id:
        sch = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not ref_filename and sch and sch.reference_image:
            ref_filename = sch.reference_image
    ref_filename = resolve_reference_image_filename(med.name, ref_filename)

    result = verify_pill_image(str(temp_path), ref_filename)

    # Ghi nhận vào nhật ký sự kiện (Append-only) nếu có schedule_id
    if schedule_id and sch:
        elder_id = sch.elder_id or getattr(med, "elder_id", 1)
        log = InteractionLog(
            schedule_id=schedule_id,
            elder_id=elder_id,
            event_type=EventType.DEVICE_RECORDED,
            cv_status=result["status"],
            device_action="CAMERA_SCAN",
            notes=f"Quét ảnh viên thuốc {med.name}: {result['label']} (độ khớp: {result['confidence_score']}, ảnh: {temp_path.name})"
        )
        db.add(log)
        db.commit()

    # Nếu không khớp hoặc độ tin cậy thấp -> gửi cảnh báo ngay cho người chăm sóc
    if result["status"] in ("MISMATCH", "LOW_CONFIDENCE"):
        alert_caregiver(
            title=f"Cảnh báo kiểm tra viên thuốc ({med.name})",
            message=result["message"],
            level="DANGER" if result["status"] == "MISMATCH" else "WARNING"
        )

    await notify_realtime_update(
        "vision_verified",
        {
            "medication_id": med.id,
            "medication_name": med.name,
            "schedule_id": schedule_id,
            "status": result["status"],
            "confidence_score": result["confidence_score"]
        }
    )

    return {
        "medication_id": med.id,
        "medication_name": med.name,
        "schedule_id": schedule_id,
        "captured_image_url": f"/storage/uploaded_checks/{temp_path.name}",
        **result
    }


@router.post("/verify-compartment")
async def verify_compartment(
    schedule_id: int = Form(...),
    elder_id: int = Form(1),
    elder_speech: Optional[str] = Form(""),
    send_to_zalo: Optional[str] = Form("true"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Đối chiếu ảnh chụp ngăn thuốc tự động từ Camera Giá Đỡ (Zero-Touch Stand Mode)
    so với ảnh mẫu tham chiếu do con cái chụp khi chia thuốc.
    """
    sch = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sch:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch uống thuốc")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File ảnh tải lên rỗng")

    try:
        temp_path = save_upload_temp(file_bytes, UPLOAD_IMG_DIR, file.filename or "compartment.jpg")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    # Tìm ảnh mẫu của ngăn thuốc hoặc của viên thuốc đầu tiên trong cữ
    ref_filename = sch.reference_image
    meds = db.query(Medication).filter(
        Medication.elder_id == sch.elder_id,
        Medication.time_period == sch.time_period,
        Medication.is_active == True
    ).all()
    if not ref_filename and meds:
        for m in meds:
            resolved = resolve_reference_image_filename(m.name, m.reference_image)
            if resolved:
                ref_filename = resolved
                break

    result = verify_pill_image(str(temp_path), ref_filename)

    has_speech = bool(elder_speech and elder_speech.strip())
    log = InteractionLog(
        schedule_id=sch.id,
        elder_id=sch.elder_id or elder_id,
        event_type=EventType.DEVICE_RECORDED,
        response_content=elder_speech.strip() if has_speech else None,
        cv_status=result["status"],
        device_action="CAMERA_SCAN",
        notes=f"Camera giá đỡ đối chiếu ngăn thuốc {sch.time_period}: {result['label']} (độ khớp: {result['confidence_score']}, ảnh: {temp_path.name})"
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    captured_url = f"/storage/uploaded_checks/{temp_path.name}"
    ref_url = f"/storage/reference_images/{ref_filename}" if ref_filename else ""

    zalo_msg = None
    if str(send_to_zalo).lower() in ("true", "1", "yes"):
        elder = db.query(User).filter(User.id == elder_id).first()
        elder_name = elder.full_name if elder else "Bác Nguyễn Văn Ba (72 tuổi)"
        med_names = [f"{m.name} ({m.dosage})" for m in meds] or ["Thuốc theo cữ"]
        zalo_msg = await zalo_service.send_pill_report(
            elder_name=elder_name,
            elder_id=elder_id,
            schedule_id=sch.id,
            time_period=sch.time_period,
            target_time=sch.target_time,
            medications=med_names,
            captured_image_url=captured_url,
            reference_image_url=ref_url,
            cv_status=result["status"],
            confidence_score=result["confidence_score"],
            elder_speech=elder_speech or "Dạ, Bác đã uống xong thuốc cữ này rồi con nhé!",
            notes=f"Camera giá đỡ chụp lúc {datetime.now().strftime('%H:%M')} - {result['label']}"
        )

    await notify_realtime_update(
        "device_recorded",
        {
            "schedule_id": sch.id,
            "elder_id": elder_id,
            "status": result["status"],
            "confidence_score": result["confidence_score"],
            "captured_image_url": captured_url
        }
    )

    return {
        "schedule_id": sch.id,
        "elder_id": elder_id,
        "captured_image_url": captured_url,
        "reference_image_url": ref_url,
        "zalo_message": zalo_msg,
        **result
    }
