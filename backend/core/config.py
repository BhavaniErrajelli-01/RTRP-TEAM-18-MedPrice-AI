import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "MedPrice AI"
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_TIMEOUT_SECONDS: int = int(os.getenv("SMTP_TIMEOUT_SECONDS", "15"))
    ADMIN_REMINDER_TOKEN: str = os.getenv("ADMIN_REMINDER_TOKEN", "")
    LIVE_SCRAPING_ENABLED: bool = os.getenv("LIVE_SCRAPING_ENABLED", "false").lower() == "true"
    SCRAPER_TIMEOUT_SECONDS: float = float(os.getenv("SCRAPER_TIMEOUT_SECONDS", "1.5"))
    SEARCH_CACHE_TTL_SECONDS: int = int(os.getenv("SEARCH_CACHE_TTL_SECONDS", "300"))

    # Can toggle to run headed for debugging
    PLAYWRIGHT_HEADLESS: bool = True

    @property
    def SUPABASE_CONFIGURED(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_KEY)

    @property
    def SMTP_CONFIGURED(self) -> bool:
        return bool(
            self.SMTP_HOST
            and self.SMTP_USERNAME
            and self.SMTP_PASSWORD
            and self.SMTP_FROM_EMAIL
        )

settings = Settings()
