"""Multi-provider, fallback-aware model router.

Wraps ADK's LiteLlm (google.adk.models.lite_llm.LiteLlm) with a custom
llm_client that, instead of calling a single hardcoded model, walks a
tier's ordered ModelSpec chain (see model_tiers.py) and falls over to the
next provider on a rate-limit/availability error from the current one —
so a skill's agent keeps working through a free-tier quota hit instead of
hard-failing.

Usage: agent.model = get_model_for_skill(skill_id)
"""

import contextvars
import logging
import os
from functools import lru_cache

import litellm
from google.adk.models.lite_llm import LiteLlm, LiteLLMClient

from app.core.config import get_settings
from app.core.model_tiers import MODEL_TIERS, ModelSpec, get_tier_for_skill

logger = logging.getLogger("buddy.model_router")

settings = get_settings()

# Propagate provider keys into env vars the way litellm/ADK expect —
# mirrors the same pattern already used for GEMINI_API_KEY/GROQ_API_KEY in
# app/core/agent.py (setdefault so an already-exported shell env var wins).
if settings.gemini_api_key:
    os.environ.setdefault("GEMINI_API_KEY", settings.gemini_api_key)
if settings.groq_api_key:
    os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)
if settings.hf_token:
    os.environ.setdefault("HF_TOKEN", settings.hf_token)

# Gemini is deliberately routed through LiteLlm (rather than ADK's native
# Gemini integration) so every tier's chain — Groq, Gemini, and the HF
# router alike — goes through the same FallbackLiteLLMClient. ADK warns
# that native Gemini would be more efficient; that trade-off is intentional
# here, so silence the warning instead of suppressing warnings generally.
os.environ.setdefault("ADK_SUPPRESS_GEMINI_LITELLM_WARNINGS", "true")

# Groq's reasoning-capable models return their chain-of-thought as a
# separate "reasoning_content" field. ADK/litellm currently round-trip that
# back into message history on the next turn, which Groq's API then
# rejects outright — breaking any multi-step tool call. Telling Groq to
# hide reasoning content at the source (its own reasoning_format param)
# avoids the bug entirely. This only applies to reasoning models; passing
# it to a non-reasoning model is a hard error, so it's applied by model
# string here rather than unconditionally.
_GROQ_REASONING_MODELS = {
    "groq/qwen/qwen3-32b",
    "groq/openai/gpt-oss-120b",
    "groq/openai/gpt-oss-20b",
    "groq/deepseek-r1-distill-llama-70b",
}

# Errors that mean "this specific provider/model step isn't usable right
# now, try the next one in the chain" rather than "the request itself is
# malformed." litellm normalizes every provider's errors onto this common
# exception hierarchy, so this covers Groq/Gemini/HF-router alike without
# any provider-specific error parsing. Deliberately includes
# AuthenticationError/NotFoundError too, not just rate-limit/connectivity
# ones — a tier should degrade gracefully (skip to the next step) when a
# provider simply isn't configured (missing/blank API key) or a model
# string has been renamed/deprecated upstream, not hard-fail the request.
FALLBACK_EXCEPTIONS = (
    litellm.RateLimitError,
    litellm.APIConnectionError,
    litellm.Timeout,
    litellm.ServiceUnavailableError,
    litellm.AuthenticationError,
    litellm.NotFoundError,
)

# --- Tracking which (tier, provider, model) actually served a request ---
#
# ADK's Runner drives an agent turn inside its own asyncio.create_task(),
# not the caller's task (see google/adk/runners.py) — a plain contextvar
# set from inside FallbackLiteLLMClient would only be visible to that
# child task, never back on the caller awaiting runner.run_async(), since
# contextvars only propagate forward into new tasks, not back out of them.
#
# So this uses a request_key (the chat session_id) instead: the caller
# sets it via request_key_var *before* calling runner.run_async() — that
# assignment *does* propagate forward into whatever child tasks ADK spawns,
# since they're created after and copy the context at creation time — and
# FallbackLiteLLMClient reads it back off the contextvar (now visible, same
# direction of travel) to know which key to record the outcome under in a
# plain, non-contextvar registry dict. The caller then looks that key up
# directly afterward — no contextvar read needed on the way out.
request_key_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "buddy_request_key", default=None
)

_served_by_registry: dict[str, dict] = {}


def pop_served_by(request_key: str) -> dict | None:
    """{"tier", "provider", "model"} for the given request_key's most
    recently completed call, or None if none has completed yet — call
    right after awaiting an agent turn (see app/api/chat.py), keyed by the
    same session_id passed to request_key_var.set() beforehand."""
    return _served_by_registry.pop(request_key, None)


def _record_served_by(tier: str, spec: ModelSpec) -> None:
    key = request_key_var.get()
    if key is not None:
        _served_by_registry[key] = {
            "tier": tier,
            "provider": spec.provider,
            "model": spec.litellm_model,
        }


def _call_kwargs(spec: ModelSpec, base_kwargs: dict) -> dict:
    kwargs = {**base_kwargs, **spec.extra_kwargs}
    if spec.litellm_model in _GROQ_REASONING_MODELS:
        kwargs.setdefault("reasoning_format", "hidden")
    return kwargs


class FallbackLiteLLMClient(LiteLLMClient):
    """Drop-in replacement for ADK's LiteLLMClient that tries an ordered
    list of models instead of one fixed one, falling over to the next on a
    rate-limit/availability error.

    ADK's LiteLlm.generate_content_async routes both streaming and
    non-streaming calls through acompletion() (see
    google/adk/models/lite_llm.py) — completion() is overridden too only
    for interface parity, in case a future ADK version or another caller
    uses it directly.

    Scope note: a provider that fails mid-stream (accepted the request,
    then errored partway through generation) is not recovered from — only
    a failure at the initial call is. That's the common shape of free-tier
    throttling (a hard 429 before any tokens stream back); recovering a
    partially-streamed response would need buffering/re-emitting partial
    output, which isn't warranted here.
    """

    def __init__(self, tier: str, chain: list[ModelSpec]):
        super().__init__()
        self.tier = tier
        self.chain = chain

    async def acompletion(self, model, messages, tools, **kwargs):
        last_exc: Exception | None = None
        for spec in self.chain:
            try:
                result = await litellm.acompletion(
                    model=spec.litellm_model,
                    messages=messages,
                    tools=tools,
                    **_call_kwargs(spec, kwargs),
                )
            except FALLBACK_EXCEPTIONS as exc:
                logger.warning(
                    "tier %s: %s (%s) unavailable (%s), falling back",
                    self.tier,
                    spec.provider,
                    spec.litellm_model,
                    exc,
                )
                last_exc = exc
                continue
            _record_served_by(self.tier, spec)
            logger.info(
                "tier %s served by %s (%s)",
                self.tier,
                spec.provider,
                spec.litellm_model,
            )
            return result
        raise last_exc

    def completion(self, model, messages, tools, stream=False, **kwargs):
        last_exc: Exception | None = None
        for spec in self.chain:
            try:
                result = litellm.completion(
                    model=spec.litellm_model,
                    messages=messages,
                    tools=tools,
                    stream=stream,
                    **_call_kwargs(spec, kwargs),
                )
            except FALLBACK_EXCEPTIONS as exc:
                last_exc = exc
                continue
            _record_served_by(self.tier, spec)
            return result
        raise last_exc


@lru_cache
def _model_for_tier(tier: str) -> LiteLlm:
    chain = MODEL_TIERS[tier]
    return LiteLlm(
        model=chain[0].litellm_model, llm_client=FallbackLiteLLMClient(tier, chain)
    )


def get_model_for_skill(skill_id: str) -> LiteLlm:
    """The LiteLlm (fallback-chain-backed) model a skill's agent should use.

    Cached per tier (not per skill) — every skill mapped to the same tier
    shares one model/client instance. Safe under concurrent requests since
    the only mutable state (_served_by_registry) is keyed by request_key,
    not stored on the instance itself.
    """
    return _model_for_tier(get_tier_for_skill(skill_id))


async def complete_with_fallback(skill_id: str, messages: list[dict], **kwargs) -> str:
    """Plain (non-agentic) text completion through the same tiered
    fallback chain a skill's chat agent uses — for one-off background text
    generation (e.g. the news digest's batch summarize+classify step) that
    wants the same Groq/Gemini/HF resilience without going through ADK's
    Agent/Runner machinery. Returns "" if every step in the chain fails,
    rather than raising, so a background job can degrade gracefully.
    """
    tier = get_tier_for_skill(skill_id)
    client = FallbackLiteLLMClient(tier, MODEL_TIERS[tier])
    try:
        response = await client.acompletion(
            model=None, messages=messages, tools=None, **kwargs
        )
    except FALLBACK_EXCEPTIONS:
        return ""
    return response.choices[0].message.content or ""


async def check_tier_availability(tier: str) -> list[dict]:
    """Probe each provider in a tier's chain with a minimal live call and
    report which currently respond vs. are rate-limited/unavailable —
    backs GET /api/debug/model-check/{skill_id}. Does not go through the
    fallback client (that would stop at the first success); this checks
    every step regardless of the others' outcome.
    """
    results = []
    for spec in MODEL_TIERS[tier]:
        entry = {"provider": spec.provider, "model": spec.litellm_model}
        try:
            await litellm.acompletion(
                model=spec.litellm_model,
                messages=[{"role": "user", "content": "ping"}],
                tools=None,
                max_tokens=1,
                **_call_kwargs(spec, {}),
            )
            entry["status"] = "ok"
        except litellm.RateLimitError as exc:
            entry["status"] = "rate_limited"
            entry["detail"] = str(exc)
        except (
            Exception
        ) as exc:  # noqa: BLE001 - deliberately broad for a diagnostic probe
            entry["status"] = "error"
            entry["detail"] = str(exc)
        results.append(entry)
    return results
