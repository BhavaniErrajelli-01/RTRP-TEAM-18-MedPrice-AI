from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import smtplib
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, Query

from core.config import settings
from core.supabase_client import supabase

router = APIRouter()


def _require_admin_token(x_admin_token: Optional[str]) -> None:
    if not settings.ADMIN_REMINDER_TOKEN:
        raise HTTPException(status_code=503, detail="ADMIN_REMINDER_TOKEN is not configured.")

    if x_admin_token != settings.ADMIN_REMINDER_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token.")


def _extract_response_data(response: Any):
    if response is None:
        return None
    if hasattr(response, "data"):
        return response.data
    if isinstance(response, tuple):
        return response[1] if len(response) > 1 else response[0]
    return response


def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _build_due_reminder(saved_medicine: dict, user_map: dict[str, dict], reminder_log_map: dict[str, str], lookahead_days: int) -> Optional[dict]:
    refill_days = int(saved_medicine.get("refill_days") or 30)
    if not saved_medicine.get("reminder_enabled", True):
        return None

    anchor = _parse_timestamp(saved_medicine.get("last_purchase_at")) or _parse_timestamp(saved_medicine.get("saved_at"))
    if anchor is None:
        return None

    now = datetime.now(timezone.utc)
    next_refill_at = anchor + timedelta(days=refill_days)
    days_until_refill = (next_refill_at.date() - now.date()).days
    if days_until_refill > lookahead_days:
        return None

    user_id = saved_medicine.get("user_id")
    user = user_map.get(user_id) or {}
    medicine_name = saved_medicine.get("medicine_name", "Medicine")

    return {
        "id": saved_medicine.get("id"),
        "user_id": user_id,
        "email": user.get("email"),
        "medicine_name": medicine_name,
        "refill_days": refill_days,
        "stock_watch": bool(saved_medicine.get("stock_watch")),
        "last_purchase_at": saved_medicine.get("last_purchase_at"),
        "next_refill_at": next_refill_at.isoformat(),
        "days_until_refill": days_until_refill,
        "last_reminder_sent_at": reminder_log_map.get(f"{user_id}:{medicine_name.lower()}"),
    }


def _send_refill_reminder_email(email: str, medicine_name: str, next_refill_at: str, refill_days: int) -> None:
    if not settings.SMTP_CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail="Email notifications are not configured yet. Add SMTP settings in backend/.env.",
        )

    next_refill_display = _parse_timestamp(next_refill_at)
    next_refill_label = next_refill_display.strftime("%d %b %Y") if next_refill_display else next_refill_at

    message = EmailMessage()
    message["Subject"] = f"Refill reminder for {medicine_name}"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                f"This is your MedPrice refill reminder for {medicine_name}.",
                f"Refill cadence: every {refill_days} days",
                f"Next refill date: {next_refill_label}",
                "",
                "Open MedPrice to compare the latest prices and check stock before you reorder.",
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
        raise HTTPException(status_code=502, detail="Unable to send refill reminder email right now.") from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Email service is currently unreachable.") from exc


def _load_due_reminders(lookahead_days: int) -> list[dict]:
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured.")

    saved_rows = _extract_response_data(
        supabase.table("saved_medicines")
        .select("id,user_id,medicine_name,saved_at,refill_days,stock_watch,reminder_enabled,last_purchase_at")
        .eq("reminder_enabled", True)
        .execute()
    ) or []

    if not saved_rows:
        return []

    user_ids = sorted({row.get("user_id") for row in saved_rows if row.get("user_id")})
    user_rows = _extract_response_data(
        supabase.table("users")
        .select("id,email")
        .in_("id", user_ids)
        .execute()
    ) if user_ids else []
    user_map = {row["id"]: row for row in (user_rows or [])}

    log_rows = _extract_response_data(
        supabase.table("refill_reminder_log")
        .select("user_id,medicine_name,sent_at")
        .order("sent_at", desc=True)
        .execute()
    ) or []
    reminder_log_map: dict[str, str] = {}
    for row in log_rows:
        key = f"{row.get('user_id')}:{str(row.get('medicine_name', '')).lower()}"
        reminder_log_map.setdefault(key, row.get("sent_at"))

    due_items = []
    for saved_medicine in saved_rows:
        reminder = _build_due_reminder(saved_medicine, user_map, reminder_log_map, lookahead_days)
        if reminder:
            due_items.append(reminder)

    due_items.sort(key=lambda item: (item["days_until_refill"], item["medicine_name"].lower()))
    return due_items


@router.get("/admin/reminders/preview")
async def preview_due_refills(
    lookahead_days: int = Query(3, ge=0, le=30),
    x_admin_token: Optional[str] = Header(None),
):
    _require_admin_token(x_admin_token)
    due_items = _load_due_reminders(lookahead_days)
    return {
        "status": "success",
        "lookahead_days": lookahead_days,
        "count": len(due_items),
        "items": due_items,
    }


@router.post("/admin/reminders/send-due")
async def send_due_refills(
    lookahead_days: int = Query(0, ge=0, le=30),
    x_admin_token: Optional[str] = Header(None),
):
    _require_admin_token(x_admin_token)
    due_items = _load_due_reminders(lookahead_days)

    sent = []
    skipped = []
    for item in due_items:
        if not item.get("email"):
            skipped.append({**item, "reason": "Missing user email"})
            continue

        _send_refill_reminder_email(
            email=item["email"],
            medicine_name=item["medicine_name"],
            next_refill_at=item["next_refill_at"],
            refill_days=item["refill_days"],
        )

        supabase.table("refill_reminder_log").insert(
            {
                "user_id": item["user_id"],
                "medicine_name": item["medicine_name"],
                "scheduled_for": item["next_refill_at"],
            }
        ).execute()
        sent.append(item)

    return {
        "status": "success",
        "lookahead_days": lookahead_days,
        "sent_count": len(sent),
        "skipped_count": len(skipped),
        "sent": sent,
        "skipped": skipped,
    }
