# ==============================================================================
# MEDIGUARD CARE - FASTAPI ENTRYPOINT RE-EXPORT
# Re-exports the unified FastAPI application from backend/main.py
# Ensures both `uvicorn main:app` and `uvicorn app.main:app` work identically
# ==============================================================================

import sys
from pathlib import Path

# Add backend directory to path if not present
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app, lifespan

__all__ = ["app", "lifespan"]

if __name__ == "__main__":
    import uvicorn
    from app.config import settings
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
