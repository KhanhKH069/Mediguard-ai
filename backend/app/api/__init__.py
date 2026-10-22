from app.api.auth import router as auth_router
from app.api.schedules import router as schedules_router
from app.api.medications import router as medications_router
from app.api.logs import router as logs_router
from app.api.vision import router as vision_router
from app.api.devices import router as devices_router
from app.api.voice import router as voice_router

__all__ = [
    "auth_router",
    "schedules_router",
    "medications_router",
    "logs_router",
    "vision_router",
    "devices_router",
    "voice_router"
]
