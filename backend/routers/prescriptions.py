from __future__ import annotations

import json
import re
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter()

KNOWN_MEDICINES = [
    "Dolo 650 Tablet",
    "Glycomet GP1 Tablet",
    "Glycomet 500 Tablet",
    "Crocin 650 Tablet",
    "Pantocid 40 Tablet",
    "Telma 40 Tablet",
    "Cetirizine 10 Tablet",
    "Limcee 500 Tablet",
    "Paracetamol 650 Tablet",
]

KNOWN_ALIASES = {
    "dolo 650": "Dolo 650 Tablet",
    "glycomet gp1": "Glycomet GP1 Tablet",
    "glycomet 500": "Glycomet 500 Tablet",
    "crocin 650": "Crocin 650 Tablet",
    "pantocid 40": "Pantocid 40 Tablet",
    "telma 40": "Telma 40 Tablet",
    "cetirizine 10": "Cetirizine 10 Tablet",
    "limcee 500": "Limcee 500 Tablet",
    "paracetamol 650": "Paracetamol 650 Tablet",
}

NOISE_WORDS = {
    "whatsapp",
    "image",
    "img",
    "jpeg",
    "jpg",
    "png",
    "pdf",
    "camera",
    "scan",
    "photo",
    "document",
    "prescription",
    "pm",
    "am",
    "at",
    "file",
    "upload",
    "note",
    "notes",
    "take",
    "daily",
    "after",
    "before",
    "morning",
    "night",
    "afternoon",
}

MEDICINE_FORM_WORDS = {
    "tablet",
    "tab",
    "capsule",
    "cap",
    "syrup",
    "suspension",
    "drops",
    "drop",
    "cream",
    "ointment",
    "gel",
    "injection",
    "inj",
}

MEDICINE_SUFFIX_WORDS = {
    "gp1",
    "xr",
    "sr",
    "cr",
    "mr",
    "od",
    "dsr",
    "forte",
    "plus",
    "md",
}


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _sanitize_for_matching(value: str) -> str:
    lowered = value.lower()
    lowered = re.sub(r"[^a-z0-9+\s]", " ", lowered)
    lowered = re.sub(r"\b\d{1,2}[:.-]\d{1,2}(?:[:.-]\d{1,2})?\b", " ", lowered)
    lowered = re.sub(r"\b20\d{2}\b", " ", lowered)
    lowered = re.sub(r"\b\d{1,2}\s*(?:am|pm)\b", " ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def _extract_known_matches(normalized: str) -> list[str]:
    matches: list[str] = []

    for alias, medicine in KNOWN_ALIASES.items():
        if alias in normalized:
            matches.append(medicine)

    return list(dict.fromkeys(matches))


def _extract_candidate_phrases(normalized: str) -> list[str]:
    phrases = re.findall(
        r"\b([a-z][a-z0-9+-]{2,}(?:\s+[a-z0-9.+-]{1,12}){0,3})\b",
        normalized,
    )
    cleaned: list[str] = []

    for phrase in phrases:
        parts = [part for part in phrase.split() if part not in NOISE_WORDS]
        if not parts:
            continue
        if all(part.isdigit() for part in parts):
            continue
        if len(parts) == 1 and (len(parts[0]) < 4 or parts[0].isdigit()):
            continue
        if not any(
            re.search(r"\d", part)
            or part in MEDICINE_FORM_WORDS
            or part in MEDICINE_SUFFIX_WORDS
            or len(part) >= 5
            for part in parts
        ):
            continue

        candidate = _format_candidate(parts)
        if candidate and candidate not in cleaned:
            cleaned.append(candidate)

    return cleaned[:6]


def _format_candidate(parts: list[str]) -> str:
    formatted = []

    for part in parts:
        lowered = part.lower()
        if re.fullmatch(r"\d+(?:\.\d+)?(?:mg|mcg|ml|gm)", lowered):
            formatted.append(lowered.upper())
        elif lowered in MEDICINE_SUFFIX_WORDS:
            formatted.append(lowered.upper())
        elif lowered in {"tab", "tablet"}:
            formatted.append("Tablet")
        elif lowered in {"cap", "capsule"}:
            formatted.append("Capsule")
        elif lowered == "syrup":
            formatted.append("Syrup")
        elif lowered in NOISE_WORDS:
            continue
        else:
            formatted.append(lowered.capitalize())

    return " ".join(formatted).strip()


def _extract_from_text(raw_text: str) -> list[str]:
    normalized = _sanitize_for_matching(raw_text)
    matches = _extract_known_matches(normalized)

    if matches:
        return matches

    return _extract_candidate_phrases(normalized)


@router.post("/prescriptions/analyze")
async def analyze_prescription(
    file: UploadFile = File(...),
    notes: Optional[str] = Form(default=None),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Prescription file is required.")

    raw_bytes = await file.read()
    file_size = len(raw_bytes)
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename
    detected_text = ""
    notes_text = notes or ""

    if content_type.startswith("text/"):
        detected_text = raw_bytes.decode("utf-8", errors="ignore")
    else:
        detected_text = notes_text

    extracted_medicines = _extract_from_text(detected_text)
    preview_source = notes_text if notes_text else filename

    return {
        "status": "success",
        "file_name": filename,
        "content_type": content_type,
        "file_size": file_size,
        "notes": notes_text,
        "ocr_status": "starter-mode",
        "extracted_medicines": extracted_medicines,
        "message": (
            "Prescription upload is active. OCR is currently running in starter mode, "
            "so please review detected medicines before comparing."
        ),
        "raw_text_preview": _normalize_text(preview_source)[:300],
        "extracted_medicines_json": json.dumps(extracted_medicines),
    }
