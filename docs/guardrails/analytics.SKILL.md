# Analytics — Guardrail Spec

## Purpose
Produce a cross-skill aggregate view (task completion, planner adherence,
finance spend-vs-budget, learning progress, habit streaks, career
pipeline) and a short natural-language weekly report grounded in those
real numbers — read-only across every other skill's data, by design.

## Allowed tools
Cross-checked against `app/skills/analytics/tools.py`.

Universal (every skill): `remember`, `recall`, `get_skill_instructions`

Analytics-specific:
- `generate_weekly_report()` — read-only from the agent's perspective (it
  calls an LLM and returns a report; it persists nothing to the
  database). Internally calls `app/common/analytics.py
  :get_analytics_overview` then `generate_weekly_report`.

## Zero Ambient Authority statement

**Requires HITL confirmation before executing:** none. This skill has
exactly one tool, and it is read-only end to end.

**Safe to auto-execute:**
- `generate_weekly_report` — read-only; safe to call on any request
  (including the frontend's own "Generate"/"Regenerate" button, which
  hits the same underlying function via REST, not through the agent at
  all — see `app/api/analytics.py:weekly_report`).

## Data boundaries — the sanctioned cross-skill exception

**This is the one skill explicitly designed to read across every other
skill's domain tables.** That is not a boundary violation — it is the
entire point of Analytics — but the boundary that *does* still apply and
must be checked in review is: **read-only, always.** Analytics must never
gain a write path into another skill's tables.

**Reads (via `app/common/analytics.py`):**
- `tasks` — `get_task_completion_rate` (windowed by `created_at`).
- `planner_items` — `get_planner_adherence` (windowed by `created_at`).
- `expenses`, `budgets` — `get_finance_summary`, which itself calls
  `app/common/finance.py:get_expense_summary` (reused, not
  reimplemented — so Analytics' finance numbers can never disagree with
  the Finance page's own numbers).
- `courses` — `get_learning_progress`.
- `habits`, `habit_logs` — `get_habit_streaks_summary`, via
  `app/common/habits.py:get_habit_streaks` (reused).
- `job_applications` — `get_career_pipeline_summary`.

**Writes:** none. No function in `app/common/analytics.py` performs an
`INSERT`/`UPDATE`/`DELETE` against any table, including its own — there is
no "own" table; Analytics has no dedicated schema at all.

**Cross-skill touches to flag in review:** a violation would be Analytics
*writing* to any of the tables above, or reading a table not listed here
(e.g. `notes`/`documents`/`news_items`/`resumes`) without first updating
this doc to justify why. Adding read access to a new domain (e.g. a future
"News read" for a content-engagement stat) is an expected kind of growth
for this skill and not inherently a violation — but it must be reviewed
and added to this list, the same as any other skill's boundary change.

## Refusal patterns
- **Must never fabricate a number.** Every figure in the weekly report
  must trace back to `get_analytics_overview`'s actual return value — the
  prompt (`app/common/analytics.py:generate_weekly_report`) is explicitly
  built to prevent this: "Below is REAL aggregate data ... the only
  numbers that exist. Do not invent, assume, or reference any number not
  listed here."
- **Must not call the LLM at all when there's no real activity** — the
  function already short-circuits to `"Not enough activity yet to
  generate a report."` when every domain's totals are zero
  (`has_data` check), a direct, deliberate fix for the same
  hallucination failure mode documented in the Finance guardrail doc (an
  earlier version of a similarly-shaped prompt fabricated a plausible
  fake scenario against all-zero real data). Any change to this function
  must preserve that short-circuit.
- Must not present the weekly report as covering a domain it doesn't
  (there is no `news`/`knowledge_base` section in the overview) — if
  asked "how's my reading going" the agent should say that's not part of
  this report rather than answering from unrelated general knowledge.
- Per `SKILL.md`: for deep detail on one specific domain (e.g. "exact
  spending by category"), the agent should point the user to that skill's
  own page/chat rather than guessing beyond what the aggregate numbers
  contain.

## Known risk notes
- **Aggregation, not deletion, is the risk shape here**: because this
  skill reads six other skills' tables, any bug in its read queries is a
  potential **information-disclosure** vector across skill boundaries
  (e.g. a query bug that leaked category-level `expenses` detail into a
  response framed as a different skill's context) — this is the
  "Information Disclosure" item examined for this skill's data flow in
  `docs/guardrails/THREAT_MODEL.md`.
- `generate_weekly_report` calls `complete_with_fallback("analytics", ...)`
  — correctly using the shared multi-provider fallback router, same
  pattern as Knowledge Base.
- No externally-ingested untrusted content flows through this skill's own
  tool — but because `get_analytics_overview` aggregates numbers derived
  from every other skill (including News/Knowledge Base's ingested-content
  pipelines indirectly, once/if those are added to the overview), this
  skill should be re-reviewed if the overview ever starts summarizing
  *text* (titles, notes) from those tables rather than pure counts/sums —
  today it only ever aggregates numeric counts and sums, never quotes
  ingested text back into a prompt.
