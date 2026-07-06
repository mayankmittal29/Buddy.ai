"""Agent Hooks — pre/post tool-call interception, wired once onto
root_agent (app/core/agent.py) via ADK's native before_tool_callback /
after_tool_callback mechanism (google/adk/agents/llm_agent.py), so every
skill's agent gets these checks automatically — get_agent_for_skill's deep
copy of root_agent inherits both callbacks, no skill has to reimplement
anything.

before_tool_callback(tool, args, tool_context) -> Optional[dict]
  Returning a non-None dict SKIPS the actual tool execution entirely and
  uses that dict as the tool's result instead (ADK's own convention).
after_tool_callback(tool, args, tool_context, tool_response) -> Optional[dict]
  Returning a non-None dict REPLACES the tool's response before it
  reaches the model's context.

Checks, cross-referenced against docs/guardrails/:
  (a) is this tool in the active skill_id's allowed-tools list
      (ROOT_AGENT.md + each <skill>.SKILL.md's "Allowed tools" section)
  (b) does this tool require HITL confirmation, and has the user actually
      confirmed in the current turn (each skill's "Zero Ambient
      Authority" section)
  (c) neutralize injection-guard patterns in string tool arguments
  (post) redact PII from the tool's response before it re-enters the
      model's context, and log tool_name/skill_id/redacted-args/success
      to LangSmith as structured trace metadata.
"""

import logging
import re
from typing import Any

from langsmith import trace

from app.common.injection_guard import neutralize_injection_attempts
from app.common.pii import redact

logger = logging.getLogger(__name__)

# The universal tools every skill's agent clone carries regardless of
# active skill_id (app/core/agent.py's root_agent.tools + get_skill_
# instructions, added by app/skills/__init__.py:load_skills) — see
# docs/guardrails/ROOT_AGENT.md.
UNIVERSAL_TOOLS = {"remember", "recall", "get_skill_instructions"}

# Cross-checked one-for-one against each app/skills/<id>/tools.py's TOOLS
# list and docs/guardrails/<id>.SKILL.md's "Allowed tools" section — keep
# both in sync whenever a skill's tools change. Finance's tools are
# discovered dynamically at runtime from the buddy-mcp MCP server (see
# app/skills/finance/tools.py) rather than declared as plain Python
# functions here, so they can't be enumerated statically the same way;
# "finance" is deliberately exempted from the allow-list check below
# rather than hardcoding a list that would silently drift from the real
# MCP server's tool set (add_expense, get_expense_summary,
# check_budget_status, add_subscription, get_savings_progress,
# get_monthly_insights — see mcp-servers/buddy-mcp/server.py).
ALLOWED_TOOLS: dict[str, set[str]] = {
    "tasks": {
        "get_current_datetime",
        "create_task",
        "list_tasks",
        "complete_task",
        "delete_task",
    },
    "planner": {
        "add_planner_item",
        "list_planner_items",
        "mark_planner_item_done",
        "compute_daily_schedule",
    },
    "news": {"generate_daily_digest", "search_news_items"},
    "career": {
        "list_resumes",
        "skill_gap_analysis",
        "list_job_applications",
        "add_job_application",
        "update_job_application_status",
    },
    "learning": {
        "add_course",
        "list_courses",
        "mark_course_done",
        "add_certification",
        "list_certifications",
        "mark_certification_done",
        "add_revision_item",
        "list_due_revision_items",
        "mark_revision_done",
        "generate_learning_roadmap",
    },
    "habits": {"add_habit", "list_habits", "log_habit_done", "get_habit_streak"},
    "knowledge_base": {"semantic_search", "answer_from_documents"},
    "analytics": {"generate_weekly_report"},
    # "finance": deliberately omitted — see comment above.
}

# Tools that must not execute without an explicit user confirmation in the
# CURRENT turn — see each skill's "Zero Ambient Authority" section.
# tasks.delete_task is the only agent-reachable destructive tool that
# exists across any skill today (every other skill's destructive actions,
# e.g. deleting a resume/habit/document, are REST-only, not chat-reachable
# at all, per each skill's guardrail doc).
HITL_REQUIRED_TOOLS: dict[str, set[str]] = {
    "tasks": {"delete_task"},
}

_CONFIRMATION_RE = re.compile(
    r"\b(yes|yeah|yep|confirm(ed)?|go ahead|do it|please delete|sure|correct)\b",
    re.IGNORECASE,
)

_SKILLS_WITHOUT_STATIC_ALLOWLIST = {"finance"}


def _current_user_text(tool_context: Any) -> str:
    """Best-effort extraction of the current turn's user message text from
    a ToolContext — used for the confirmation-phrase heuristic below."""
    content = getattr(tool_context, "user_content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return ""
    return " ".join(p.text for p in parts if getattr(p, "text", None))


def _redact_args(args: dict) -> dict:
    redacted = {}
    for key, value in args.items():
        if isinstance(value, str):
            redacted_value, _findings = redact(value)
            redacted[key] = redacted_value
        else:
            redacted[key] = value
    return redacted


def _redact_nested(value: Any) -> tuple[Any, int]:
    """Recursively redact PII from strings anywhere inside a (possibly
    nested) dict/list tool response. Returns (redacted_value, count)."""
    if isinstance(value, str):
        redacted_value, findings = redact(value)
        return redacted_value, len(findings)
    if isinstance(value, dict):
        count = 0
        result = {}
        for k, v in value.items():
            result[k], c = _redact_nested(v)
            count += c
        return result, count
    if isinstance(value, list):
        count = 0
        result = []
        for v in value:
            r, c = _redact_nested(v)
            result.append(r)
            count += c
        return result, count
    return value, 0


async def _log_blocked(skill_id: str, tool_name: str, reason: str, args: dict) -> None:
    logger.warning(
        "agent_hooks.blocked: skill=%s tool=%s reason=%s", skill_id, tool_name, reason
    )
    try:
        async with trace(
            "tool_call_blocked",
            run_type="tool",
            inputs={"args": _redact_args(args)},
            metadata={
                "skill_id": skill_id,
                "tool_name": tool_name,
                "success": False,
                "blocked_reason": reason,
            },
        ) as run:
            run.end(outputs={"blocked": True, "reason": reason})
    except Exception:
        logger.exception("agent_hooks: failed to log blocked tool call to LangSmith")


async def check_tool_call(tool: Any, args: dict, tool_context: Any) -> dict | None:
    """before_tool_callback — see module docstring for ADK's short-circuit
    convention. Returns an error dict (blocking execution) if the tool
    isn't allowed for the active skill or needs confirmation that hasn't
    been given; otherwise mutates `args` in place to neutralize any
    injection-guard patterns and returns None (proceed normally)."""
    skill_id = tool_context.state.get("active_skill", "general")
    tool_name = getattr(tool, "name", str(tool))

    # (a) allow-list check
    if skill_id not in _SKILLS_WITHOUT_STATIC_ALLOWLIST:
        allowed = UNIVERSAL_TOOLS | ALLOWED_TOOLS.get(skill_id, set())
        if tool_name not in allowed:
            reason = (
                f"tool '{tool_name}' is not in the allowed-tools list for "
                f"skill '{skill_id}' (see docs/guardrails/)"
            )
            await _log_blocked(skill_id, tool_name, reason, args)
            return {"error": reason}

    # (b) HITL confirmation check
    if tool_name in HITL_REQUIRED_TOOLS.get(skill_id, set()):
        if not _CONFIRMATION_RE.search(_current_user_text(tool_context)):
            reason = (
                f"'{tool_name}' requires explicit user confirmation before executing. "
                "Ask the user to confirm this specific action, then only retry once "
                "they clearly say yes/confirm in their next message."
            )
            await _log_blocked(skill_id, tool_name, reason, args)
            return {"error": reason, "needs_confirmation": True}

    # (c) neutralize injection-guard patterns in string args in place —
    # don't block the call outright, since a legitimate "store this exact
    # (odd-looking) text" request must still succeed (see
    # evals/cases/tasks_cases.yaml's tasks_adversarial_injection_in_title
    # case) — only the embedded directive itself is defused.
    for key, value in list(args.items()):
        if isinstance(value, str):
            args[key] = neutralize_injection_attempts(value)

    return None


async def record_tool_result(
    tool: Any, args: dict, tool_context: Any, tool_response: dict
) -> dict | None:
    """after_tool_callback — redacts PII from the tool's response before
    it re-enters the model's context, and logs the call to LangSmith."""
    skill_id = tool_context.state.get("active_skill", "general")
    tool_name = getattr(tool, "name", str(tool))

    redacted_response, pii_count = _redact_nested(tool_response)

    try:
        async with trace(
            "tool_call",
            run_type="tool",
            inputs={"args": _redact_args(args)},
            metadata={
                "skill_id": skill_id,
                "tool_name": tool_name,
                "success": True,
                "pii_redactions": pii_count,
            },
        ) as run:
            run.end(outputs={"response": redacted_response})
    except Exception:
        logger.exception("agent_hooks: failed to log tool call to LangSmith")

    return redacted_response if pii_count else None
