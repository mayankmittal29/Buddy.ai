# Buddy backend

## Model router

Chat models are resolved per-skill through a tiered, multi-provider fallback
router instead of one hardcoded model. Every skill belongs to one of three
tiers (`app/core/model_tiers.py`); each tier is an ordered list of
provider/model steps that the router (`app/core/model_router.py`) tries in
turn, falling over to the next one on a rate-limit or availability error
from the current one — so hitting a free-tier quota on Groq or Gemini
degrades to the next provider instead of hard-failing the request.

- **Tier A** (fast/simple) — short turns, little or no tool use.
- **Tier B** (tool-calling heavy) — multi-step tool use is the common case.
- **Tier C** (long-context/reasoning) — large inputs, fewer tool calls.

Each tier's default chain tries Groq first (fastest/cheapest), then either
Gemini or a Hugging Face Inference Providers router model, depending on the
tier — see the comments in `model_tiers.py` for the current chain and why
each step is ordered where it is.

### Swap or reorder a model in a tier

Edit the relevant list in `MODEL_TIERS` (`app/core/model_tiers.py`) — e.g.
to replace Tier B's tool-calling step:

```python
TIER_B: [
    ModelSpec("groq", "groq/llama-3.3-70b-versatile"),
    ModelSpec("huggingface", "huggingface/featherless-ai/NousResearch/Hermes-3-Llama-3.1-8B"),
    ModelSpec("gemini", "gemini/gemini-2.5-flash"),
],
```

`litellm_model` is whatever string litellm's `completion()`/`acompletion()`
expects for that provider (see https://docs.litellm.ai/docs/providers —
these strings and which models a given Hugging Face Inference Provider
partner currently hosts do change over time, so re-verify against the
provider's docs / https://huggingface.co/models before changing one).
Nothing else needs to change — no other file references specific model
strings.

### Add a new skill

Add one line to `SKILL_TIER` in `app/core/model_tiers.py`:

```python
SKILL_TIER: dict[str, str] = {
    ...
    "my_new_skill": TIER_B,
}
```

A skill not listed here falls back to `DEFAULT_TIER` (currently Tier A).
The skill doesn't need to exist yet (have an `app/skills/<id>/` folder) for
this mapping to be valid — it's the source of truth for when it does.

### Debugging the fallback chain locally

`GET /api/debug/model-check/{skill_id}` makes a minimal live call to every
provider in that skill's tier and reports which ones currently respond vs.
are rate-limited/erroring — independent of each other, unlike a real
request (which stops at the first success). Useful for confirming e.g.
"Groq is rate-limited right now but Gemini and the HF router are both
fine" without waiting to actually exhaust a quota during normal use.

### Observability

Every chat turn's LangSmith trace (`buddy_chat`) records a `served_by`
metadata field — `{"tier", "provider", "model"}` for whichever step in the
chain actually served that turn — set the moment a call succeeds, so a
mid-chain fallback is visible in the trace even though the request as a
whole succeeded.

### Required env vars

`GROQ_API_KEY`, `GEMINI_API_KEY`, `HF_TOKEN` (see `.env.example`). A tier
still works with only some of these configured — the missing provider's
step just fails fast (auth error) and falls through to the next one — but
all three gives the most resilience against any single provider's
rate limits.
