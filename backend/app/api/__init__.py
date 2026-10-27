# ==============================================================================
# MEDIGUARD API PACKAGE
# Exports routers for Authentication, Schedules, Medications, Voice, etc.
# ==============================================================================

from .auth import router as auth_router
from .schedules import router as schedules_router
from .medications import router as medications_router
from .logs import router as logs_router
from .devices import router as devices_router
from .voice import router as voice_router
from .zalo import router as zalo_router
from .symptoms import router as symptoms_router
from .drugs import router as drugs_router
from .ai import router as ai_router
from .calls import router as calls_router
from .vision import router as vision_router
from .storage import router as storage_router
from .websocket import router as websocket_router, manager as ws_manager, set_main_loop, manager

__all__ = [
    "auth_router",
    "schedules_router",
    "medications_router",
    "logs_router",
    "devices_router",
    "voice_router",
    "zalo_router",
    "symptoms_router",
    "drugs_router",
    "ai_router",
    "calls_router",
    "vision_router",
    "storage_router",
    "websocket_router",
    "ws_manager",
    "manager",
    "set_main_loop",
]
