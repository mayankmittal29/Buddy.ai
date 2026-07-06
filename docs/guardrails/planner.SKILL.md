# Planner — Guardrail Spec

## Purpose
Help the user build and track daily/weekly/monthly plans (goal items with
optional hours-needed/deadline), and compute a time-blocked daily schedule
around their fixed commitments.

## Allowed tools
Cross-checked against `app/skills/planner/tools.py`.

Universal (every skill): `remember`, `recall`, `get_skill_instructions`

Planner-specific:
- `add_planner_item(mode, title, hours_needed, deadline)` — write.
- `list_planner_items(mode, status)` — read-only.
- `mark_planner_item_done(item_id)` — write (status change only).
- `compute_daily_schedule()` — read-only (computes and returns a schedule,
  does not persist anything).

## Zero Ambient Authority statement

**Requires HITL confirmation before executing:** none of this skill's
current tools are destructive — there is no `delete_planner_item` tool at
all today (deletion, if supported, exists only via the REST API/frontend,
not as an agent tool). If a `delete_planner_item` tool is added later, it
must be added to this list and gated the same way `tasks.delete_task` is.

**Safe to auto-execute:**
- `add_planner_item` — additive. Per its own docstring, when building a
  weekly/monthly plan the agent is expected to call this once per row of a
  multi-item breakdown without pausing for confirmation on each one — that
  is intentional design, not a gap, since the whole plan is trivially
  reviewable/editable afterward in the UI.
- `list_planner_items` — read-only.
- `mark_planner_item_done` — non-destructive status flip.
- `compute_daily_schedule` — read-only; reads `user_profile` and pending
  `planner_items` and returns a computed suggestion, persists nothing.

## Data boundaries

**Reads:**
- `planner_items` (own table).
- `user_profile` (`wake_time`, `sleep_time`, `meal_times`) — read-only, via
  `compute_daily_schedule`. Shared table owned by Profile/Settings; Planner
  never writes to it.

**Writes:**
- `planner_items` (own table) only.

**Cross-skill touches to flag in review:** none currently. Planner reading
`user_profile` is a sanctioned, narrow read (three specific columns) — not
a violation. A violation would be Planner writing to `user_profile`, or
reading/writing `tasks`, `courses`, or any other skill's table.

## Refusal patterns
- Must not invent `hours_needed` or a `deadline` the user never stated —
  leave them null rather than guessing a number to make the schedule look
  more complete.
- When building a weekly/monthly breakdown, must not silently drop the
  user's stated hours/day constraint or deadline to make the numbers work
  out — if the plan doesn't fit, say so, don't fabricate a schedule that
  looks feasible but ignores the constraint.
- `compute_daily_schedule` must not claim a task was scheduled if it
  actually landed in `"unscheduled"` in the tool's own return value — the
  agent must reflect the tool's real output, not a rosier summary of it.

## Known risk notes
- No PII/injection exposure specific to this skill — plan titles/details
  are first-party user input.
- `compute_daily_schedule`'s meal-time parsing (`_parse_hhmm`) tolerates
  malformed `meal_times` entries by skipping them (`except (ValueError,
  AttributeError): continue`) rather than crashing the whole schedule
  computation — a defensive default, not a security control.
