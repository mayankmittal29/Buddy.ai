# Tasks — Guardrail Spec

## Purpose
Let the user create, list, complete, and delete personal to-do items with
priority/due-date/recurrence, and resolve relative dates against the user's
real-world local time.

## Allowed tools
Cross-checked against `app/skills/tasks/tools.py` and the universal set
every skill's agent clone carries (`app/core/agent.py`).

Universal (every skill): `remember`, `recall`, `get_skill_instructions`

Tasks-specific:
- `get_current_datetime()` — read-only. Resolves the real current date/time
  in the user's profile timezone.
- `create_task(title, due_at, priority, recurrence_rule)` — write.
- `list_tasks(status, priority)` — read-only.
- `complete_task(task_id)` — write (status change only).
- `delete_task(task_id)` — write, **destructive/irreversible**.

## Zero Ambient Authority statement

**Requires HITL confirmation before executing:**
- `delete_task` — permanent deletion. The tool's own docstring already
  says "Always confirm with the user before calling this," but that is
  currently a prompt-level instruction only, not an enforced gate — see
  `docs/guardrails/ROOT_AGENT.md` and Prompt 11.5.7. Until `agent_hooks.py`
  enforces it, treat this as a known gap, not a solved one.

**Safe to auto-execute:**
- `get_current_datetime` — read-only, no side effects.
- `list_tasks` — read-only.
- `create_task` — additive, non-destructive, trivially undoable by deleting
  the task; matches this skill's own established convention of not
  blocking on confirmation for simple additions.
- `complete_task` — non-destructive status flip, reversible (no "undo
  complete" tool exists today, but the row and its data are preserved, so
  the underlying information is never lost).

## Data boundaries

**Reads:**
- `tasks` (own table).
- `user_profile.timezone` — read-only, via `_get_profile_timezone()`. This
  is a shared table (owned by the Profile/Settings feature, not Tasks) —
  Tasks only ever reads this one column, never writes to `user_profile`.

**Writes:**
- `tasks` (own table) only.

**Cross-skill touches to flag in review:** none currently. If a future
change makes any Tasks tool write to `user_profile`, `planner_items`, or
any other skill's table, that is a boundary violation to catch — Tasks
should only ever mutate its own `tasks` rows.

## Refusal patterns
- Must not fabricate a due date/priority the user didn't state or imply —
  default `priority` to `"normal"` (per the tool's own docstring) rather
  than guessing "urgent" to seem more helpful, and leave `due_at` null
  rather than inventing one.
- Must not claim a task was created/completed/deleted without an actual
  successful tool call confirming it (this is the general system-prompt
  rule, but worth restating here since it's this skill's most common
  failure mode — a model narrating "I've added that task" without calling
  `create_task` at all).
- Must not silently reinterpret "delete all my tasks" as a loop of
  `delete_task` calls without confirming the destructive, irreversible,
  bulk nature of that action first.

## Known risk notes
- `create_task`'s `due_at` parsing (`_parse_due_at`) deliberately strips
  any UTC offset/`Z` the model attaches and re-localizes against the
  user's stored profile timezone, because "smaller models are unreliable
  at reasoning about UTC offsets" (see the code comment). This is a
  correctness safeguard, not a security boundary, but it means a
  malformed/adversarial `due_at` string is parsed defensively rather than
  trusted — a bad value degrades to `None` (fromisoformat raising) rather
  than being silently misinterpreted across a timezone boundary.
- No PII/injection exposure specific to this skill — task titles/notes are
  first-party user input, not ingested external content.
