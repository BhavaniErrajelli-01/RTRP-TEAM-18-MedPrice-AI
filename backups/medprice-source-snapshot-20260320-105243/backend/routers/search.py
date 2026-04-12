from fastapi import APIRouter, Query
import re

from scrapers.implementations import search_all_platforms

router = APIRouter()

ALTERNATIVE_RULES = {
    "dolo 650": [
        {"alternative_name": "Paracetamol 650", "composition": "Paracetamol 650mg", "match_reason": "Same generic composition", "dosage_match": True},
        {"alternative_name": "Crocin 650", "composition": "Paracetamol 650mg", "match_reason": "Same composition and dosage", "dosage_match": True},
        {"alternative_name": "Calpol 650", "composition": "Paracetamol 650mg", "match_reason": "Same composition and dosage", "dosage_match": True},
    ],
    "paracetamol": [
        {"alternative_name": "Crocin", "composition": "Paracetamol 500mg", "match_reason": "Popular branded alternative", "dosage_match": True},
        {"alternative_name": "Calpol", "composition": "Paracetamol 500mg", "match_reason": "Popular branded alternative", "dosage_match": True},
        {"alternative_name": "Dolo 500", "composition": "Paracetamol 500mg", "match_reason": "Same generic composition", "dosage_match": True},
    ],
    "crocin": [
        {"alternative_name": "Paracetamol 500", "composition": "Paracetamol 500mg", "match_reason": "Lower-cost generic option", "dosage_match": True},
        {"alternative_name": "Dolo 500", "composition": "Paracetamol 500mg", "match_reason": "Same generic composition", "dosage_match": True},
        {"alternative_name": "Calpol 500", "composition": "Paracetamol 500mg", "match_reason": "Same composition and dosage", "dosage_match": True},
    ],
    "vitamin c": [
        {"alternative_name": "Limcee", "composition": "Vitamin C 500mg", "match_reason": "Same active ingredient", "dosage_match": True},
        {"alternative_name": "Celin", "composition": "Ascorbic Acid 500mg", "match_reason": "Equivalent vitamin C formulation", "dosage_match": True},
        {"alternative_name": "Vitcee", "composition": "Vitamin C 500mg", "match_reason": "Same composition", "dosage_match": True},
    ],
    "cetirizine": [
        {"alternative_name": "Cetzine", "composition": "Cetirizine 10mg", "match_reason": "Same generic composition", "dosage_match": True},
        {"alternative_name": "Okacet", "composition": "Cetirizine 10mg", "match_reason": "Same composition and dosage", "dosage_match": True},
    ],
}

CHEAPER_GENERIC_HINTS = {
    "dolo": "A plain paracetamol generic often costs less than the branded version.",
    "crocin": "Generic paracetamol is usually the lower-cost option.",
    "cetirizine": "Generic cetirizine tablets are often cheaper than premium brands.",
}


def _normalize_query(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _extract_dosage(value: str):
    dosage_match = re.search(r"(\d+\s*mg)", value)
    if not dosage_match:
        return None
    return dosage_match.group(1).replace(" ", "").lower()


def _enrich_alternative(item: dict, query: str):
    normalized_query = _normalize_query(query)
    dosage = _extract_dosage(normalized_query)
    alt_dosage = _extract_dosage(_normalize_query(item.get("composition", "")))
    is_same_dosage = bool(dosage and alt_dosage and dosage == alt_dosage)

    enriched = {
        **item,
        "dosage_match": item.get("dosage_match", is_same_dosage),
        "match_reason": item.get("match_reason") or ("Same dosage and composition" if is_same_dosage else "Related alternative"),
        "recommended_for": "Ask your doctor or pharmacist to confirm substitution if this is a prescription medicine.",
    }

    for brand_hint, price_hint in CHEAPER_GENERIC_HINTS.items():
        if brand_hint in normalized_query and "generic" not in enriched["match_reason"].lower():
            enriched["price_hint"] = price_hint
            break

    return enriched


def _infer_alternatives(query: str):
    normalized = _normalize_query(query)

    if normalized in ALTERNATIVE_RULES:
        return [_enrich_alternative(item, query) for item in ALTERNATIVE_RULES[normalized]]

    for known_name, alternatives in ALTERNATIVE_RULES.items():
        if normalized in known_name or known_name in normalized:
            return [_enrich_alternative(item, query) for item in alternatives]

    dosage_match = re.search(r"(\d+\s*mg)", normalized)
    if "paracetamol" in normalized and dosage_match:
        dosage = dosage_match.group(1).replace(" ", "")
        return [
            _enrich_alternative({"alternative_name": f"Crocin {dosage}", "composition": f"Paracetamol {dosage}", "match_reason": "Same composition and dosage"}, query),
            _enrich_alternative({"alternative_name": f"Calpol {dosage}", "composition": f"Paracetamol {dosage}", "match_reason": "Same composition and dosage"}, query),
        ]

    if "vitamin c" in normalized or "ascorbic" in normalized:
        return [_enrich_alternative(item, query) for item in ALTERNATIVE_RULES["vitamin c"]]

    return []


def _build_search_summary(query: str, results: list[dict]):
    in_stock = [result for result in results if result["availability"] == "In Stock"]
    considered = in_stock or results
    if not considered:
        return {
            "best_time_to_buy": "Unavailable",
            "price_prediction": "Not enough data",
            "best_platform": None,
            "estimated_savings": 0,
        }

    best_result = min(considered, key=lambda item: item["price"])
    highest_result = max(considered, key=lambda item: item["price"])
    average_price = sum(item["price"] for item in considered) / len(considered)
    spread = highest_result["price"] - best_result["price"]

    if spread >= 4:
        best_time_to_buy = "Good time to buy now because the lowest current option is meaningfully below the rest."
        price_prediction = "Prices look favorable right now."
    elif spread <= 1.5:
        best_time_to_buy = "Prices are tightly grouped. Buying now or later is unlikely to change the cost much."
        price_prediction = "Price movement is likely to stay stable in the short term."
    else:
        best_time_to_buy = "Worth buying if needed soon, but keep an eye on alerts for a slightly better drop."
        price_prediction = "A modest price dip is possible, but not guaranteed."

    dosage = _extract_dosage(_normalize_query(query))
    return {
        "best_time_to_buy": best_time_to_buy,
        "price_prediction": price_prediction,
        "best_platform": best_result["platform"],
        "estimated_savings": round(max(0, average_price - best_result["price"]), 2),
        "dosage_context": dosage,
    }


@router.get("/search")
async def search_medicine(query: str = Query(..., description="Name of the medicine to search")):
    """
    Search for a medicine across different platforms.
    """
    results = await search_all_platforms(query)

    in_stock = [r for r in results if r["availability"] == "In Stock"]
    if in_stock:
        cheapest = min(in_stock, key=lambda x: x["price"])
        for r in results:
            r["best_deal"] = r == cheapest

    results.sort(key=lambda x: (x["price"], x["availability"] != "In Stock"))
    return {"query": query, "results": results, "summary": _build_search_summary(query, results)}


@router.get("/alternatives")
async def get_alternatives(query: str = Query(...)):
    """
    Get generic alternatives for a given medicine.
    """
    alternatives = _infer_alternatives(query)
    return {"query": query, "alternatives": alternatives}
