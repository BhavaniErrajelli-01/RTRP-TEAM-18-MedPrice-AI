import re
from typing import Any, List

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from core.config import settings
from routers.search import _infer_alternatives

router = APIRouter()


PRICE_KEYWORDS = {"price", "cost", "cheapest", "cheap", "compare", "buy", "best deal"}
ALTERNATIVE_KEYWORDS = {"alternative", "alternatives", "substitute", "generic", "brand"}
TIMING_KEYWORDS = {"before food", "after food", "timing", "when should i take", "take", "dose schedule"}
SAFETY_KEYWORDS = {"side effect", "side effects", "precaution", "interaction", "safe", "allergy"}
URGENT_KEYWORDS = {"pregnant", "pregnancy", "child", "baby", "severe", "emergency", "overdose", "chest pain", "trouble breathing"}
SAVINGS_KEYWORDS = {"save money", "monthly", "wallet", "refill", "subscription", "budget"}

KNOWN_MEDICINES = [
    "dolo 650",
    "paracetamol",
    "crocin",
    "calpol",
    "cetirizine",
    "vitamin c",
    "limcee",
    "celin",
]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class ChatAction(BaseModel):
    type: str
    label: str
    payload: str | None = None


class ChatResponse(BaseModel):
    reply: str
    intent: str
    suggestions: List[str] = []
    actions: List[ChatAction] = []
    safety_note: str | None = None
    extracted_medicines: List[str] = []


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _extract_medicines(message: str) -> List[str]:
    normalized = _normalize(message)
    found = [medicine for medicine in KNOWN_MEDICINES if medicine in normalized]

    dosage_match = re.findall(r"\b([a-z]+(?:\s+[a-z]+)?\s+\d+\s*mg)\b", normalized)
    for item in dosage_match:
        if item not in found:
            found.append(item)

    quoted = re.findall(r"'([^']+)'|\"([^\"]+)\"", message)
    for left, right in quoted:
        candidate = _normalize(left or right)
        if candidate and candidate not in found:
            found.append(candidate)

    return found[:4]


def _detect_intent(message: str) -> str:
    normalized = _normalize(message)

    if any(keyword in normalized for keyword in URGENT_KEYWORDS):
        return "safety"
    if any(keyword in normalized for keyword in PRICE_KEYWORDS):
        return "price"
    if any(keyword in normalized for keyword in ALTERNATIVE_KEYWORDS):
        return "alternatives"
    if any(keyword in normalized for keyword in TIMING_KEYWORDS):
        return "timing"
    if any(keyword in normalized for keyword in SAFETY_KEYWORDS):
        return "safety"
    if any(keyword in normalized for keyword in SAVINGS_KEYWORDS):
        return "savings"

    return "general"


def _build_actions(intent: str, medicines: List[str]) -> List[ChatAction]:
    actions: List[ChatAction] = []

    if medicines:
        primary = medicines[0]
        actions.append(ChatAction(type="search_medicine", label=f"Search {primary}", payload=primary))

        if len(medicines) > 1:
            actions.append(
                ChatAction(
                    type="compare_basket",
                    label="Compare Basket",
                    payload=", ".join(medicines),
                )
            )

        if intent in {"alternatives", "general"}:
            actions.append(ChatAction(type="show_alternatives", label=f"Show Alternatives", payload=primary))

    if intent == "savings":
        actions.append(ChatAction(type="suggest_prompt", label="Ask For Monthly Savings Tips", payload="How can I reduce my monthly medicine spending?"))

    return actions[:3]


def _build_suggestions(intent: str, medicines: List[str]) -> List[str]:
    primary = medicines[0] if medicines else "this medicine"

    suggestion_map = {
        "price": [
            f"Compare prices for {primary}",
            f"Show cheaper alternatives for {primary}",
            "How do I save more on monthly medicines?",
        ],
        "alternatives": [
            f"Search {primary}",
            f"What is the brand vs generic difference for {primary}?",
            "Which substitutions need pharmacist confirmation?",
        ],
        "timing": [
            f"What should I confirm before taking {primary}?",
            "When should I ask a pharmacist about timing?",
            "What medicine instructions should never be guessed?",
        ],
        "safety": [
            "When should I talk to a pharmacist immediately?",
            "What medicine combinations should be double-checked?",
            "What details should I verify on a prescription label?",
        ],
        "savings": [
            "Compare a basket of medicines",
            "Which platform usually gives the best price?",
            "How do refill reminders help save money?",
        ],
        "general": [
            "Compare medicine prices",
            "Ask about generic alternatives",
            "Ask about timing or precautions",
        ],
    }

    return suggestion_map[intent]


def _build_rule_based_reply(intent: str, medicines: List[str]) -> tuple[str, str | None]:
    primary = medicines[0] if medicines else "the medicine"

    if intent == "price":
        return (
            f"I can help with that. Search {primary} to compare live prices, see the best current deal, and check whether waiting may save you more.",
            None,
        )

    if intent == "alternatives":
        alternatives = _infer_alternatives(primary) if medicines else []
        if alternatives:
            top_names = ", ".join(item["alternative_name"] for item in alternatives[:3])
            return (
                f"For {primary}, strong alternatives include {top_names}. Check composition and dosage carefully, and confirm prescription substitutions with a doctor or pharmacist.",
                None,
            )
        return (
            f"I can help compare brand and generic options for {primary}. The safest approach is to match active ingredient, strength, and dosage form before switching.",
            None,
        )

    if intent == "timing":
        return (
            "Medicine timing depends on the specific drug, formulation, and your prescription. Use the label first, and confirm with a pharmacist if the medicine is for pain, diabetes, antibiotics, or long-term treatment.",
            "Do not guess timing for prescription medicines when the label is unclear.",
        )

    if intent == "safety":
        return (
            "I can share general medicine safety guidance, but I cannot diagnose or confirm whether a medicine is safe for your exact situation. Please speak with a doctor or pharmacist for urgent symptoms, pregnancy, child dosing, allergies, or medicine combinations.",
            "Get professional help promptly for severe symptoms, breathing trouble, overdose concerns, or serious reactions.",
        )

    if intent == "savings":
        return (
            "A smart way to save is to compare medicines together, watch refill timing, and check whether a lower-cost generic has the same active ingredient and dosage.",
            None,
        )

    return (
        "I can help with medicine prices, generic alternatives, buying decisions, timing guidance, precautions, and shopping tips. Tell me the medicine name or the question you have.",
        None,
    )


async def _generate_ai_reply(messages: List[ChatMessage], intent: str, medicines: List[str]) -> str | None:
    if not settings.GEMINI_API_KEY:
        return None

    try:
        conversation = "\n".join(
            f"{message.role.title()}: {message.content}"
            for message in messages[-6:]
        )
        medicine_context = ", ".join(medicines) if medicines else "none detected"
        prompt = (
            "You are MedPrice AI, an advanced informational medication shopping and education assistant. "
            "Be practical, concise, and warm. Explain prices, generics, precautions, dosage-form differences, timing questions, refill planning, and savings ideas. "
            "Do not diagnose. Do not prescribe. Do not provide exact clinical treatment instructions. "
            "If pregnancy, child dosing, severe symptoms, overdose, allergies, or medicine interactions appear, advise consulting a doctor or pharmacist. "
            f"Detected intent: {intent}. "
            f"Detected medicines: {medicine_context}. "
            "Respond in plain text in 3 short paragraphs or fewer.\n\n"
            f"Conversation:\n{conversation}"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        payload: dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}]
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)

        if response.status_code != 200:
            return None

        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None


@router.post("/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest):
    user_msg = request.messages[-1].content if request.messages else ""
    medicines = _extract_medicines(user_msg)
    intent = _detect_intent(user_msg)

    ai_reply = await _generate_ai_reply(request.messages, intent, medicines)
    fallback_reply, safety_note = _build_rule_based_reply(intent, medicines)

    return ChatResponse(
        reply=ai_reply or fallback_reply,
        intent=intent,
        suggestions=_build_suggestions(intent, medicines),
        actions=_build_actions(intent, medicines),
        safety_note=safety_note,
        extracted_medicines=medicines,
    )
