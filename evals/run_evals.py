#!/usr/bin/env python
"""Eval runner for Prompt 11.5.4.

Replays each skill's golden cases (evals/cases/<skill>_cases.yaml) against
the ACTUAL ADK agent for that skill_id (app/core/session.py
:get_runner_for_skill — the same runner the real chat API uses), records
the real tool-call trajectory via each event's get_function_calls(), traces
the case to LangSmith (same `trace()` helper app/api/chat.py uses), and
checks:
  - trajectory match: expected_tool_calls appears as an order-preserving
    subsequence of the actual tool-call sequence (extra calls in between,
    e.g. remember(), are tolerated — LLM trajectories are not perfectly
    deterministic, so exact-sequence matching would be too brittle).
  - outcome rubric: a simple keyword-overlap check between
    expected_outcome's description and the agent's final response text
    (not exact-text matching, per Prompt 11.5.4's own wording).

Usage:
  cd evals && ../backend/venv/bin/python run_evals.py
  ../backend/venv/bin/python run_evals.py --skill tasks
  ../backend/venv/bin/python run_evals.py --skill tasks --limit 2
"""

import argparse
import asyncio
import re
import sys
import uuid
from pathlib import Path

import yaml

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.core import tracing  # noqa: E402,F401  (propagates LangSmith env vars)
from app.core.session import (  # noqa: E402
    APP_NAME,
    DEFAULT_USER_ID,
    get_runner_for_skill,
    session_service,
)
from google.genai import types  # noqa: E402
from langsmith import trace  # noqa: E402

CASES_DIR = Path(__file__).resolve().parent / "cases"

_STOPWORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "of",
    "to",
    "in",
    "on",
    "for",
    "with",
    "as",
    "by",
    "at",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "this",
    "that",
    "not",
    "no",
    "only",
    "never",
    "must",
    "should",
    "would",
    "could",
    "rather",
    "than",
    "its",
    "their",
    "they",
    "he",
    "she",
    "you",
    "your",
    "grounded",
    "actual",
    "return",
    "value",
    "tools",
    "agent",
    "rather",
    "than",
    "either",
    "will",
    "does",
    "do",
}


def _keywords(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9_]*", (text or "").lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _is_subsequence(expected: list[str], actual: list[str]) -> bool:
    """True if `expected` appears in `actual`, in order (gaps allowed)."""
    it = iter(actual)
    return all(name in it for name in expected)


def load_cases(skill_filter: str | None, limit: int | None) -> dict[str, list[dict]]:
    cases_by_skill: dict[str, list[dict]] = {}
    for path in sorted(CASES_DIR.glob("*_cases.yaml")):
        skill_id = path.stem.removesuffix("_cases")
        if skill_filter and skill_id != skill_filter:
            continue
        cases = yaml.safe_load(path.read_text()) or []
        if limit:
            cases = cases[:limit]
        cases_by_skill[skill_id] = cases
    return cases_by_skill


async def run_case(skill_id: str, case: dict) -> dict:
    session_id = f"eval-{skill_id}-{case['id']}-{uuid.uuid4().hex[:6]}"
    await session_service.create_session(
        app_name=APP_NAME, user_id=DEFAULT_USER_ID, session_id=session_id
    )
    runner = get_runner_for_skill(skill_id)
    new_message = types.Content(role="user", parts=[types.Part(text=case["input"])])

    tool_calls: list[str] = []
    final_text = ""
    error: str | None = None

    async with trace(
        "eval_case",
        run_type="chain",
        inputs={"input": case["input"]},
        metadata={
            "skill_id": skill_id,
            "case_id": case["id"],
            "category": case.get("category"),
        },
    ) as run:
        try:
            async for event in runner.run_async(
                user_id=DEFAULT_USER_ID, session_id=session_id, new_message=new_message
            ):
                for call in event.get_function_calls():
                    tool_calls.append(call.name)
                if event.content and event.content.parts and not event.partial:
                    for part in event.content.parts:
                        if part.text:
                            final_text += part.text
        except (
            Exception
        ) as exc:  # noqa: BLE001 - eval harness must not crash on one bad case
            error = str(exc)
        run.end(
            outputs={"tool_calls": tool_calls, "final_text": final_text, "error": error}
        )

    expected_tools = case.get("expected_tool_calls") or []
    trajectory_ok = _is_subsequence(expected_tools, tool_calls)

    expected_words = _keywords(case.get("expected_outcome", ""))
    actual_words = _keywords(final_text)
    overlap = (
        (len(expected_words & actual_words) / len(expected_words))
        if expected_words
        else 1.0
    )
    outcome_ok = overlap >= 0.25

    return {
        "id": case["id"],
        "category": case.get("category", ""),
        "passed": bool(trajectory_ok and outcome_ok and error is None),
        "trajectory_ok": trajectory_ok,
        "outcome_ok": outcome_ok,
        "tool_calls": tool_calls,
        "expected_tool_calls": expected_tools,
        "overlap": round(overlap, 2),
        "error": error,
        "final_text": final_text[:200],
    }


def print_summary(results_by_skill: dict[str, list[dict]]) -> bool:
    all_passed = True
    print("\n" + "=" * 78)
    print(f"{'SKILL':<16}{'PASS/TOTAL':<12}{'FAILED CASES'}")
    print("-" * 78)
    for skill_id, results in results_by_skill.items():
        passed = sum(1 for r in results if r["passed"])
        total = len(results)
        failed = [r["id"] for r in results if not r["passed"]]
        if failed:
            all_passed = False
        print(f"{skill_id:<16}{f'{passed}/{total}':<12}{', '.join(failed) or '-'}")
    print("=" * 78)

    for skill_id, results in results_by_skill.items():
        for r in results:
            if r["passed"]:
                continue
            print(f"\n--- FAILED: {skill_id}/{r['id']} ({r['category']}) ---")
            print(f"  expected_tool_calls: {r['expected_tool_calls']}")
            print(f"  actual tool_calls:   {r['tool_calls']}")
            print(
                f"  trajectory_ok={r['trajectory_ok']}  outcome_ok={r['outcome_ok']} (overlap={r['overlap']})"
            )
            if r["error"]:
                print(f"  error: {r['error']}")
            print(f"  final_text: {r['final_text']!r}")
    return all_passed


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skill", help="Only run this skill_id's cases (e.g. tasks, knowledge_base)"
    )
    parser.add_argument(
        "--limit", type=int, help="Only run the first N cases per skill"
    )
    args = parser.parse_args()

    cases_by_skill = load_cases(args.skill, args.limit)
    if not cases_by_skill:
        print(f"No case files matched skill={args.skill!r}")
        return 1

    results_by_skill: dict[str, list[dict]] = {}
    for skill_id, cases in cases_by_skill.items():
        results = []
        for case in cases:
            print(f"Running {skill_id}/{case['id']}...")
            results.append(await run_case(skill_id, case))
        results_by_skill[skill_id] = results

    all_passed = print_summary(results_by_skill)
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
