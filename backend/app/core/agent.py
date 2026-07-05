import os
from importlib import import_module
from types import ModuleType

from google.adk.agents import Agent

from app.common.memory import recall, remember
from app.core.config import get_settings

settings = get_settings()

if settings.gemini_api_key:
    os.environ.setdefault("GEMINI_API_KEY", settings.gemini_api_key)
if settings.groq_api_key:
    os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)

# litellm model string defaults per provider, used when LLM_MODEL is blank.
# groq/llama-3.3-70b-versatile was tried first but reliably emits malformed
# tool-call syntax once more than ~1 tool is available at once; qwen3-32b
# (below) calls tools correctly.
_PROVIDER_DEFAULT_MODELS = {
    "groq": "groq/qwen/qwen3-32b",
}

# Groq's reasoning-capable models return their chain-of-thought as a separate
# "reasoning_content" field. ADK/litellm currently round-trip that back into
# message history on the next turn, which Groq's API then rejects outright —
# breaking any multi-step tool call. Telling Groq to hide reasoning content at
# the source (its own reasoning_format param) avoids the bug entirely. This
# only applies to reasoning models; passing it to a non-reasoning model is a
# hard error, so it's opt-in per model here.
_GROQ_REASONING_MODELS = {
    "groq/qwen/qwen3-32b",
    "groq/openai/gpt-oss-120b",
    "groq/openai/gpt-oss-20b",
    "groq/deepseek-r1-distill-llama-70b",
}


def _build_model() -> str | object:
    """Build the chat model from LLM_PROVIDER/LLM_MODEL.

    "gemini" (default) needs no extra setup beyond GEMINI_API_KEY — passed
    straight through to ADK as a model name string. Any other provider name
    is treated as a litellm provider (e.g. "groq", "openrouter", "together"):
    set LLM_PROVIDER plus that provider's API key env var (litellm resolves
    it, e.g. GROQ_API_KEY), and optionally LLM_MODEL if you want a model
    other than this file's default for that provider.
    """
    provider = settings.llm_provider.lower()
    if provider == "gemini":
        return settings.llm_model or "gemini-2.5-flash"

    from google.adk.models.lite_llm import LiteLlm

    model_name = settings.llm_model or _PROVIDER_DEFAULT_MODELS.get(provider)
    if model_name is None:
        raise ValueError(
            f"Unknown llm_provider '{provider}' with no LLM_MODEL set. "
            "Set LLM_MODEL to a litellm model string, e.g. "
            "'groq/qwen/qwen3-32b' (see https://docs.litellm.ai/docs/providers)."
        )

    extra_kwargs = {}
    if model_name in _GROQ_REASONING_MODELS:
        extra_kwargs["reasoning_format"] = "hidden"

    return LiteLlm(model=model_name, **extra_kwargs)


SYSTEM_PROMPT = """\
You are Buddy, the user's personal productivity assistant.

Tone: warm, encouraging, and concise. Respect the user's time — get to the useful
part immediately, skip filler and restating the question.

You operate across multiple "skills" (domains such as tasks, notes, or calendar),
only one of which is active at a time. Adapt your behaviour, vocabulary, and the
tools you reach for to whatever skill is currently active, and stay within that
skill's domain unless the user clearly asks to switch. If the active skill has no
tool for something the user asks, say so plainly rather than guessing or making
something up — never claim you did something (created, updated, deleted,
scheduled, etc.) unless a tool call actually confirms it happened. If you don't
have the right tool, tell the user directly instead of pretending to comply.

You have long-term memory, shared across all skills and sessions: use the
remember tool proactively whenever the user states a durable preference,
routine, or other detail worth keeping (not one-off details), and use the
recall tool whenever something you already know about the user could help
with the current request — even if it was learned under a different skill.
"""

root_agent = Agent(
    name="Buddy",
    model=_build_model(),
    instruction=SYSTEM_PROMPT,
    tools=[remember, recall],
    sub_agents=[],
)


def register_skill(agent: Agent, skill_module: ModuleType) -> None:
    """Register a skill module's tools and sub-agents onto the given agent.

    A skill module may expose:
      - TOOLS: list of ADK tools/callables (default: [])
      - SUB_AGENTS: list of BaseAgent to add as sub-agents (default: [])

    This lets new skills plug into the root agent by adding a module under
    app/skills/ and registering it (see app/skills/__init__.py), without
    editing this file.
    """
    agent.tools.extend(getattr(skill_module, "TOOLS", []))
    agent.sub_agents.extend(getattr(skill_module, "SUB_AGENTS", []))


_skill_agent_cache: dict[str, Agent] = {}


def get_agent_for_skill(skill_id: str) -> Agent:
    """Return the Agent to use while chatting under a given skill.

    If app/skills/<skill_id>/tools.py exists, returns a dedicated clone of
    root_agent with that skill's TOOLS/SUB_AGENTS added — so those tools are
    only ever available while that skill is active, never bleeding into
    other skills' conversations. Skills with no tools.py (e.g. "general")
    just get the shared root_agent, with only the universal tools
    (remember/recall/get_skill_instructions).
    """
    if skill_id in _skill_agent_cache:
        return _skill_agent_cache[skill_id]

    try:
        tools_module = import_module(f"app.skills.{skill_id}.tools")
    except ModuleNotFoundError:
        return root_agent

    agent = root_agent.model_copy(deep=True)
    register_skill(agent, tools_module)
    _skill_agent_cache[skill_id] = agent
    return agent
