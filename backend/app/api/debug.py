from fastapi import APIRouter

from app.core.model_router import check_tier_availability
from app.core.model_tiers import get_tier_for_skill

router = APIRouter()


@router.get("/api/debug/model-check/{skill_id}")
async def model_check(skill_id: str) -> dict:
    """Probe every provider in skill_id's tier with a live, minimal call and
    report which currently respond vs. are rate-limited/unavailable right
    now — for manually confirming the fallback chain during local testing.

    Unlike a real request (which stops at the first provider that
    succeeds), this checks every step in the chain regardless of the
    others' outcome, so you can see e.g. "Groq is rate-limited but Gemini
    and the HF router are both fine" in one call.
    """
    tier = get_tier_for_skill(skill_id)
    results = await check_tier_availability(tier)
    return {"skill_id": skill_id, "tier": tier, "providers": results}
