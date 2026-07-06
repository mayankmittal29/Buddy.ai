# Habits — Guardrail Spec

## Purpose
Let the user track daily habits and log completion conversationally,
computing streaks and celebrating milestone streaks (10/30/50/100 days)
via a notification.

## Allowed tools
Cross-checked against `app/skills/habits/tools.py`.

Universal (every skill): `remember`, `recall`, `get_skill_instructions`

Habits-specific:
- `add_habit(title, description)` — write.
- `list_habits()` — read-only.
- `log_habit_done(habit_id, done)` — write (toggles today's log; also
  triggers a milestone check, see Data boundaries below).
- `get_habit_streak(habit_id)` — read-only.

## Zero Ambient Authority statement

**Requires HITL confirmation before executing:** none of the current
agent tools delete anything (no `delete_habit` tool exists in chat — it's
REST-only, `app/api/habits.py`, gated by a `window.confirm()` on the
frontend). If a `delete_habit` agent tool is added, it must be HITL-gated
like `tasks.delete_task` — deleting a habit also cascades to deleting all
its `habit_logs` history.

**Safe to auto-execute:**
- `list_habits`, `get_habit_streak` — read-only.
- `add_habit` — additive.
- `log_habit_done` — per `SKILL.md`'s own instruction, only call this
  "if a log doesn't already reflect what they're saying; don't toggle
  blindly if they're just talking about the habit in passing" — this is a
  correctness rule (avoid spurious toggles from casual mentions), not a
  HITL rule; the toggle itself is safe/reversible (can be toggled back)
  and does not require user confirmation once the agent has correctly
  identified intent to log.

## Data boundaries

**Reads:**
- `habits`, `habit_logs` (own tables).

**Writes:**
- `habits`, `habit_logs` (own tables) via `add_habit`/`log_habit_done`.
- `log_habit_done` also calls `app.common.scheduler.check_habit_milestone`,
  which writes a `Notification` row when a streak crosses 10/30/50/100 —
  this is the shared, cross-skill notification pipeline (see
  `docs/guardrails/ROOT_AGENT.md`), the same sanctioned pattern used by
  Tasks/Learning/News's scheduler jobs. Not a boundary violation.

**Cross-skill touches to flag in review:** the `Notification` write above
is the only cross-table touch, and it is sanctioned (see pattern note). A
real violation would be any Habits tool reading/writing `tasks`, `courses`,
or any other skill's domain table.

## Refusal patterns
- Must not toggle `log_habit_done` from an ambiguous or passing mention of
  a habit — per `SKILL.md`, only log when the user is actually reporting
  doing (or not doing) it today.
- Must not invent a streak number — `current_streak`/`longest_streak` must
  always come from `get_habit_streak`/`log_habit_done`'s actual return
  value, never estimated from conversation context.
- If the user names a habit that doesn't exist, must offer to add it via
  `add_habit` rather than guessing an id and calling `log_habit_done`
  against the wrong habit (per `SKILL.md`).
- Must not claim a milestone notification was sent unless
  `check_habit_milestone` actually fired (i.e. don't congratulate the user
  on a "30-day streak" achievement in chat if the streak is actually 29).

## Known risk notes
- `set_habit_today`/`log_habit_done` deliberately **recompute**
  `times_done`/`last_done` from the real `habit_logs` rows after every
  toggle (`app/common/habits.py:set_habit_today`) rather than
  incrementing/decrementing counters — this was a deliberate fix for a
  real bug class (un-toggling a non-latest day going out of sync with an
  earlier done day). Any future change to this logic must preserve the
  recompute-from-source-of-truth approach rather than reintroducing
  incremental counters.
- No externally-ingested untrusted content in this skill — habit
  titles/descriptions are first-party user input.
