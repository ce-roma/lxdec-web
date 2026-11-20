from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.core.config import settings

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title=f"{settings.distro_name} Topology API",
    description="Interactive Architecture & Package Topology API for LXDEC OS (Debian-based derivative)",
    version=settings.distro_version,
)

app.include_router(api_router)


@app.get("/healthz", tags=["health"])
async def healthcheck() -> dict[str, str]:
    """Health check endpoint for Google Cloud Run and Docker orchestrators."""
    return {
        "status": "ok",
        "service": "lxdec-web",
        "version": settings.distro_version,
    }


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def serve_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
