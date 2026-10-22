import sys
import os
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

# Đảm bảo UTF-8 trên Windows console, tránh UnicodeEncodeError khi log tiếng Việt
if sys.platform == "win32":
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import STORAGE_DIR, REF_IMAGES_DIR
from app.database import engine, Base, SessionLocal
from app.models import User, Medication, Schedule
from app.core.security import get_password_hash
from app.core.scheduler_service import start_scheduler, shutdown_scheduler
from app.voice.tts_service import (
    text_to_speech,
    generate_reminder_speech,
    generate_confirmation_speech,
    generate_unsure_speech,
    generate_help_speech,
)

from app.api import (
    auth_router,
    schedules_router,
    medications_router,
    logs_router,
    vision_router,
    devices_router,
    voice_router,
    websocket_router,
    ws_manager,
    set_main_loop,
)

# ----------------------------------------------------------------------
# Cấu hình & logging
# ----------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mediguard")

# ENV: "dev" (mặc định) hoặc "prod"
ENV = os.getenv("ENV", "dev").lower()
IS_DEV = ENV == "dev"

# Chỉ nạp dữ liệu mẫu ở môi trường dev (hoặc khi bật cờ thủ công)
SEED_DEMO_DATA = os.getenv("SEED_DEMO_DATA", "true" if IS_DEV else "false").lower() == "true"

# Danh sách origin được phép, ngăn cách bằng dấu phẩy.
# Ví dụ: ALLOWED_ORIGINS="https://app.example.com,http://localhost:3000"
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]


# ----------------------------------------------------------------------
# Dữ liệu mẫu
# ----------------------------------------------------------------------
def seed_sample_data():
    """
    Nạp dữ liệu mẫu ban đầu nếu cơ sở dữ liệu chưa có dữ liệu.
    Chỉ chạy khi SEED_DEMO_DATA=true (mặc định bật ở dev, tắt ở prod).
    """
    if not SEED_DEMO_DATA:
        logger.info("Bỏ qua nạp dữ liệu mẫu (SEED_DEMO_DATA=false).")
        return

    db = SessionLocal()
    try:
        ref_amlodipine = REF_IMAGES_DIR / "ref_amlodipine.jpg"
        ref_path_str = "ref_amlodipine.jpg" if ref_amlodipine.exists() else None

        if db.query(User).count() == 0:
            # Mật khẩu demo có thể đổi qua biến môi trường
            demo_password = os.getenv("DEMO_PASSWORD", "123456")

            # 1. Người cao tuổi
            elder = User(
                username="ong_ba",
                full_name="Bác Nguyễn Văn Ba (72 tuổi)",
                hashed_password=get_password_hash(demo_password),
                role="ELDER",
                phone_number="0901234567",
            )
            # 2. Người chăm sóc (con trai)
            caregiver = User(
                username="anh_nam",
                full_name="Nguyễn Văn Nam (Con trai)",
                hashed_password=get_password_hash(demo_password),
                role="CAREGIVER",
                phone_number="0987654321",
            )
            db.add_all([elder, caregiver])
            db.commit()

            # Liên kết người chăm sóc với người cao tuổi
            caregiver.assigned_elders.append(elder)
            db.commit()

            # 3. Thuốc mẫu
            med1 = Medication(
                elder_id=elder.id,
                name="Amlodipine 5mg",
                category="Thuốc Huyết Áp",
                dosage="1 viên",
                instruction="Uống sau khi ăn sáng 30 phút với nước ấm",
                time_period="Sáng",
                reference_image=ref_path_str,
            )
            med2 = Medication(
                elder_id=elder.id,
                name="Ginkgo Biloba 120mg",
                category="Thuốc Bổ Não",
                dosage="1 viên",
                instruction="Uống sau bữa ăn sáng",
                time_period="Sáng",
            )
            med3 = Medication(
                elder_id=elder.id,
                name="Omeprazole 20mg",
                category="Thuốc Dạ Dày",
                dosage="1 viên",
                instruction="Uống trước ăn tối 30 phút",
                time_period="Tối",
            )
            db.add_all([med1, med2, med3])
            db.commit()

            # 4. Lịch dùng thuốc ĐÃ ĐƯỢC XÁC MINH bởi người chăm sóc
            sch_morning = Schedule(
                elder_id=elder.id,
                time_period="Sáng",
                target_time="07:30",
                verified_by=caregiver.id,
                notes="Đã đối chiếu theo đơn thuốc Bệnh viện Lão Khoa ngày 15/10",
            )
            sch_evening = Schedule(
                elder_id=elder.id,
                time_period="Tối",
                target_time="19:00",
                verified_by=caregiver.id,
                notes="Đã đối chiếu theo đơn thuốc",
            )
            db.add_all([sch_morning, sch_evening])
            db.commit()
            logger.info(">>> Đã nạp thành công dữ liệu mẫu cho MediGuard AI!")
        else:
            # Nếu DB đã có dữ liệu nhưng med1 chưa có reference_image, tự động gán ảnh mẫu
            existing_med1 = db.query(Medication).filter(Medication.name.like("%Amlodipine%")).first()
            if existing_med1 and not existing_med1.reference_image and ref_path_str:
                existing_med1.reference_image = ref_path_str
                db.commit()
                logger.info(">>> Đã cập nhật ảnh mẫu tham chiếu cho Amlodipine 5mg.")
    except Exception:
        db.rollback()
        logger.exception("Lỗi khi nạp dữ liệu mẫu")
    finally:
        db.close()


# ----------------------------------------------------------------------
# Precache audio
# ----------------------------------------------------------------------
# Chỉ các câu chào/chung chung, KHÔNG chứa tên thuốc hay tên người
GENERIC_PHRASES = [
    "Xin chào bác! Cháu là trợ lý nhắc thuốc MediGuard A I. Chúc bác một ngày thật nhiều sức khỏe!",
    "Cháu đang lắng nghe. Bác cứ bấm micro hoặc chọn câu mẫu bên dưới để nói chuyện nhé!",
    "Cháu đã ghi nhận bác vừa uống thuốc xong rồi ạ! Cháu đã cập nhật nhật ký và gửi thông báo cho người thân. Bác nhớ uống đủ nước ấm và nghỉ ngơi thật thoải mái nhé!",
    "Dạ cháu nghe đây ạ! Bác có muốn cháu đọc lại lịch uống thuốc hay cần cháu giúp gì không ạ?",
    "Bác đừng lo lắng nhé. Nếu chưa chắc chắn, bác cứ để nguyên vỉ thuốc ở đó, cháu sẽ báo cho người nhà kiểm tra lại giúp bác ngay ạ.",
    "Dạ, cháu đã gửi thông báo yêu cầu trợ giúp khẩn cấp đến gia đình của bác rồi ạ.",
]


def build_dialogue_jobs() -> list[tuple[str, str, list[str]]]:
    """
    Lấy từ DB các cữ thuốc ĐÃ được xác minh: (tên người cao tuổi, buổi, danh sách thuốc).
    Câu thoại do dialogue_manager sinh -> trùng khớp với câu thật khi chạy.
    """
    jobs: list[tuple[str, str, list[str]]] = []
    db = SessionLocal()
    try:
        schedules = db.query(Schedule).filter(Schedule.verified_by.isnot(None), Schedule.is_active.is_(True)).all()
        for sch in schedules:
            elder = db.query(User).filter(User.id == sch.elder_id).first()
            meds = (
                db.query(Medication)
                .filter(
                    Medication.elder_id == sch.elder_id,
                    Medication.time_period == sch.time_period,
                    Medication.is_active.is_(True),
                )
                .all()
            )
            if not elder or not meds:
                continue
            jobs.append((elder.full_name, sch.time_period, [m.name for m in meds]))
    except Exception:
        logger.exception("Lỗi khi dựng danh sách câu thoại từ DB")
    finally:
        db.close()
    return jobs


async def precache_essential_audio():
    """
    Tạo sẵn file âm thanh cho các câu thoại cố định ngay khi khởi động Backend
    để Kiosk phát tiếng tức thời.
    """
    ok, failed = 0, 0

    def tally(audio: str):
        nonlocal ok, failed
        if audio:
            ok += 1
        else:
            failed += 1

    # 1. Câu chung chung
    for phrase in GENERIC_PHRASES:
        tally(await text_to_speech(phrase))

    # 2. Câu theo dữ liệu thật
    jobs = await asyncio.to_thread(build_dialogue_jobs)
    seen_elders: set[str] = set()
    for elder_name, period, med_names in jobs:
        audio, _ = await generate_reminder_speech(elder_name, period, med_names)
        tally(audio)
        audio, _ = await generate_confirmation_speech(elder_name, period, med_names)
        tally(audio)
        if elder_name not in seen_elders:  # câu "không chắc" và "cần giúp" chỉ phụ thuộc người
            seen_elders.add(elder_name)
            audio, _ = await generate_unsure_speech(elder_name)
            tally(audio)
            audio, _ = await generate_help_speech(elder_name)
            tally(audio)

    logger.info("Precache audio xong: %d thành công, %d lỗi.", ok, failed)


# ----------------------------------------------------------------------
# Lifespan & App
# ----------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo bảng DB (về lâu dài nên chuyển sang Alembic migration)
    Base.metadata.create_all(bind=engine)
    seed_sample_data()

    # Thiết lập main event loop cho module websocket để broadcast đồng bộ tức thời
    try:
        set_main_loop(asyncio.get_running_loop())
    except Exception as e:
        logger.warning(f"Không thể thiết lập main loop cho websocket: {e}")

    # Bật scheduler giám sát quá hạn
    start_scheduler()

    # Tạo trước audio chạy ngầm — GIỮ tham chiếu để task không bị garbage collect
    precache_task = asyncio.create_task(precache_essential_audio())

    try:
        yield
    finally:
        precache_task.cancel()
        try:
            await precache_task
        except asyncio.CancelledError:
            pass
        shutdown_scheduler()


app = FastAPI(
    title="MediGuard AI - Medication Management Assistant",
    description="Trợ lý AI hỗ trợ quản lý lịch dùng thuốc tại nhà cho người cao tuổi",
    version="1.0.0-maxping",
    lifespan=lifespan,
)

# CORS Middleware — liệt kê origin cụ thể (không dùng "*" cùng allow_credentials=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đảm bảo thư mục lưu trữ tồn tại trước khi mount (tránh RuntimeError)
Path(STORAGE_DIR).mkdir(parents=True, exist_ok=True)

# Mount thư mục lưu trữ static (audio cache, ảnh tham chiếu, ảnh chụp)
# LƯU Ý: thư mục này đang công khai. Ảnh thuốc/ảnh chụp là dữ liệu sức khỏe nhạy cảm,
# nên cân nhắc chỉ mount thư mục con audio, hoặc phục vụ ảnh qua endpoint có xác thực.
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

# Đăng ký các router
app.include_router(auth_router)
app.include_router(schedules_router)
app.include_router(medications_router)
app.include_router(logs_router)
app.include_router(vision_router)
app.include_router(devices_router)
app.include_router(voice_router)
app.include_router(websocket_router)


@app.get("/api/ping")
def ping_instant():
    """
    Endpoint phản hồi tức thời (sub-millisecond) để đo ping RTT thực tế
    """
    import time
    return {
        "status": "ok",
        "pong": True,
        "mode": "maxping",
        "timestamp": time.time(),
        "active_ws_clients": len(ws_manager.active_connections),
    }


@app.get("/api/health")
def health_check():
    import time
    from sqlalchemy import text
    start = time.perf_counter()
    db = SessionLocal()
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        db.close()
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    return {
        "status": "healthy" if db_ok else "degraded",
        "ping_ms": duration_ms,
        "database": "connected" if db_ok else "disconnected",
        "active_ws_clients": len(ws_manager.active_connections),
        "version": "1.0.0-maxping-ultra",
        "service": "MediGuard AI Engine",
    }


@app.get("/")
def root():
    return {
        "app": "MediGuard AI",
        "status": "Online",
        "docs_url": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=IS_DEV,  # chỉ auto-reload ở dev
        reload_dirs=["app"],  # Chỉ theo dõi thư mục app, tránh reload liên tục khi lưu audio_cache hoặc SQLite DB
    )