"""Model tier definitions for Buddy's multi-provider, fallback-aware router.

Skills are grouped into three tiers by workload shape rather than each
skill picking its own model — fewer knobs to tune, and a provider swap only
ever touches this file. Each tier is an ordered list of ModelSpecs; the
router (model_router.py) tries them in order, falling over to the next one
on a rate-limit/availability error from the current one.

To swap or reorder a model within a tier: edit the relevant list below.
To add a new skill: add one line to SKILL_TIER (see the bottom of this
file). Nothing else needs to change in either case.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ModelSpec:
    """One provider/model step in a tier's fallback chain.

    provider: short human-readable label — shows up in logs, LangSmith
      trace metadata, and the /api/debug/model-check/{skill_id} endpoint.
    litellm_model: the exact string passed to litellm's completion() /
      acompletion() `model=` argument (see https://docs.litellm.ai/docs/providers
      for the provider-prefix format, e.g. "groq/...", "gemini/...",
      "huggingface/<inference-provider>/<org>/<model>").
    extra_kwargs: any additional kwargs this specific model needs on every
      call (e.g. a provider-specific param) — merged into the call after
      ADK's own kwargs, so these win on conflict.
    """

    provider: str
    litellm_model: str
    extra_kwargs: dict = field(default_factory=dict)


TIER_A = "A"  # fast/simple — short turns, little or no tool use
TIER_B = "B"  # tool-calling heavy — multi-step tool use is the common case
TIER_C = "C"  # long-context/reasoning — large inputs, fewer tool calls

# Verified against each provider's current docs / litellm's provider list
# (2026-07-06) — see backend/README for how these were chosen and how to
# re-verify one later. All three resolve correctly under the litellm
# version pinned in requirements.txt.
MODEL_TIERS: dict[str, list[ModelSpec]] = {
    TIER_A: [
        ModelSpec("groq", "groq/llama-3.1-8b-instant"),
        ModelSpec("gemini", "gemini/gemini-2.0-flash"),
        ModelSpec("huggingface", "huggingface/novita/meta-llama/Llama-3.1-8B-Instruct"),
    ],
    TIER_B: [
        # NOTE: this project's own earlier testing (see the git history of
        # app/core/agent.py) found groq/llama-3.3-70b-versatile reliably
        # emits malformed tool-call syntax once more than ~1 tool is
        # available at once — groq/qwen/qwen3-32b was the model that
        # actually worked reliably. Kept here because it's what was
        # explicitly requested for this tier; if Planner/Finance/Career
        # start throwing tool-call parse errors, swap this line for
        # ModelSpec("groq", "groq/qwen/qwen3-32b") (already flows through
        # the reasoning_format handling in model_router.py automatically).
        ModelSpec("groq", "groq/llama-3.3-70b-versatile"),
        ModelSpec(
            "huggingface",
            "huggingface/featherless-ai/NousResearch/Hermes-3-Llama-3.1-8B",
        ),
        ModelSpec("gemini", "gemini/gemini-2.5-flash"),
    ],
    TIER_C: [
        ModelSpec("gemini", "gemini/gemini-2.5-flash"),
        ModelSpec("huggingface", "huggingface/novita/Qwen/Qwen2.5-72B-Instruct"),
        ModelSpec("groq", "groq/llama-3.3-70b-versatile"),
    ],
}

# Which tier each skill's agent uses. Skills not listed here fall back to
# DEFAULT_TIER. A skill doesn't need to exist yet (have an app/skills/<id>/
# folder) to be listed here — this mapping is the source of truth for
# when it does.
SKILL_TIER: dict[str, str] = {
    "tasks": TIER_A,
    "habits": TIER_A,
    "planner": TIER_B,
    "finance": TIER_B,
    "career": TIER_B,
    "news": TIER_C,
    "learning": TIER_C,
    "knowledge_base": TIER_C,
    "analytics": TIER_C,
}

DEFAULT_TIER = TIER_A


def get_tier_for_skill(skill_id: str) -> str:
    """Which tier a skill's agent should use — DEFAULT_TIER if unlisted
    (e.g. "general", or a new skill not yet added to SKILL_TIER)."""
    return SKILL_TIER.get(skill_id, DEFAULT_TIER)
