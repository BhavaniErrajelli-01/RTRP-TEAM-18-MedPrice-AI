from email.message import EmailMessage
import smtplib
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from core.config import settings
from core.supabase_client import supabase

router = APIRouter()


class SaveRequest(BaseModel):
    medicine_name: str


class NotifyRequest(BaseModel):
    medicine_name: str
    target_price: float


class EmailAlertRequest(BaseModel):
    email: str
    medicine_name: str
    target_price: float
    current_price: float


def get_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    return "00000000-0000-0000-0000-000000000000"


def send_price_alert_email(email: str, medicine_name: str, target_price: float, current_price: float):
    if not settings.SMTP_CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail="Email notifications are not configured yet. Add SMTP settings in backend/.env.",
        )

    message = EmailMessage()
    message["Subject"] = f"Price alert reached for {medicine_name}"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                f"Good news. Your price alert for {medicine_name} has been reached.",
                f"Target price: Rs. {target_price:.2f}",
                f"Current tracked price: Rs. {current_price:.2f}",
                "",
                "Open MedPrice AI to compare the latest pharmacy options.",
            ]
        )
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS) as server:
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls()
                server.ehlo()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
    except smtplib.SMTPException as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to send the email alert right now. Please verify the SMTP settings and try again.",
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail="Email service is currently unreachable. Please try again later.",
        ) from exc


def _extract_response_data(response):
    if response is None:
        return None

    if hasattr(response, "data"):
        return response.data

    if isinstance(response, tuple):
        return response[1] if len(response) > 1 else response[0]

    return response


@router.post("/save")
async def save_medicine(req: SaveRequest, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not supabase:
        return {"status": "mock", "message": f"Saved {req.medicine_name} (Database not connected)"}

    try:
        response = supabase.table("saved_medicines").insert(
            {"user_id": user_id, "medicine_name": req.medicine_name}
        ).execute()
        return {"status": "success", "data": _extract_response_data(response)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to save the medicine right now.") from exc


@router.get("/history")
async def get_history(authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not supabase:
        return {"status": "mock", "history": []}

    try:
        response = (
            supabase.table("search_history")
            .select("*")
            .eq("user_id", user_id)
            .order("searched_at", desc=True)
            .limit(20)
            .execute()
        )
        return {"status": "success", "history": _extract_response_data(response) or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to load search history right now.") from exc


@router.post("/notify")
async def set_notification(req: NotifyRequest, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not supabase:
        return {"status": "mock", "message": f"Alert set for {req.medicine_name} at {req.target_price}"}

    try:
        response = supabase.table("notifications").insert(
            {
                "user_id": user_id,
                "medicine_name": req.medicine_name,
                "target_price": req.target_price,
            }
        ).execute()
        return {"status": "success", "data": _extract_response_data(response)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to create the price alert right now.") from exc


@router.post("/notify-email")
async def notify_email(req: EmailAlertRequest):
    try:
        send_price_alert_email(
            email=req.email,
            medicine_name=req.medicine_name,
            target_price=req.target_price,
            current_price=req.current_price,
        )
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error while sending the email alert.") from exc
