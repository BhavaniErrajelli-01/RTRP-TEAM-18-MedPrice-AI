from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from core.supabase_client import supabase
from routers import search, chat, user_data

app = FastAPI(title=settings.PROJECT_NAME)

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

@app.get("/")
async def root():
    return {"message": "Welcome to MedPrice AI API"}


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
