from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from core.config import settings
from core.supabase_client import supabase
from routers import prescriptions, reminders, search, chat, user_data

app = FastAPI(title=settings.PROJECT_NAME)
frontend_dist_dir = Path(__file__).resolve().parents[1] / "frontend" / "dist"

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict this to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(user_data.router, prefix="/api", tags=["user_data"])
app.include_router(reminders.router, prefix="/api", tags=["reminders"])
app.include_router(prescriptions.router, prefix="/api", tags=["prescriptions"])

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "services": {
            "supabase": "configured" if settings.SUPABASE_CONFIGURED and supabase else "disabled",
            "smtp": "configured" if settings.SMTP_CONFIGURED else "disabled",
        },
    }


if frontend_dist_dir.exists():
    assets_dir = frontend_dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/favicon.svg")
    async def favicon():
        return FileResponse(frontend_dist_dir / "favicon.svg")

    @app.get("/icons.svg")
    async def icons():
        return FileResponse(frontend_dist_dir / "icons.svg")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith(("api/", "docs", "openapi.json", "redoc", "health")):
            return {"message": "Not found"}

        requested_file = frontend_dist_dir / full_path
        if full_path and requested_file.is_file():
            return FileResponse(requested_file)

        return FileResponse(frontend_dist_dir / "index.html")

else:
    @app.get("/")
    async def root():
        return {"message": "Welcome to MedPrice AI API"}
