# Learning — Guardrail Spec

## Purpose
Track courses, certifications, and a spaced-repetition revision queue, and
generate an ordered learning roadmap across the user's planned/in-progress
courses.

## Allowed tools
Cross-checked against `app/skills/learning/tools.py`.

Universal (every skill): `remember`, `recall`, `get_skill_instructions`

Learning-specific:
- `add_course(title, provider, deadline)` — write.
- `list_courses(status)` — read-only.
- `mark_course_done(course_id)` — write (status change only).
- `add_certification(title, issuer)` — write.
- `list_certifications(status)` — read-only.
- `mark_certification_done(cert_id, date_received)` — write (status
  change only).
- `add_revision_item(topic, notes, interval_days)` — write.
- `list_due_revision_items()` — read-only.
- `mark_revision_done(item_id)` — write (advances the spaced-repetition
  interval).
- `generate_learning_roadmap(goal)` — write (calls Gemini directly to
  order courses, then persists `roadmap_position`/`roadmap_rationale`
  onto each `Course` row).

Note: certification file upload/delete (with Cloudinary/R2 cleanup) is
REST-only (`app/api/learning.py`) — not exposed as an agent tool.

## Zero Ambient Authority statement

**Requires HITL confirmation before executing:** none of the current
agent tools delete anything (no `delete_course`/`delete_certification`
tool exists in chat). If one is added later, it must be HITL-gated the
same as `tasks.delete_task`.

**Safe to auto-execute:**
- All `list_*`/`list_due_*` calls — read-only.
- `add_course`, `add_certification`, `add_revision_item` — additive.
- `mark_course_done`, `mark_certification_done`, `mark_revision_done` —
  non-destructive status/schedule updates.
- `generate_learning_roadmap` — reorders/annotates existing courses
  (`roadmap_position`, `roadmap_rationale`); does not delete or create
  courses, and is trivially re-run/overwritten by calling it again.

## Data boundaries

**Reads:**
- `courses`, `certifications`, `revision_items` (own tables).

**Writes:**
- `courses`, `certifications`, `revision_items` (own tables) only.
  `generate_learning_roadmap` writes only to `courses.roadmap_position`
  and `courses.roadmap_rationale` — never touches `certifications` or
  `revision_items`.

**Cross-skill touches to flag in review:** none. A violation would be any
Learning tool reading/writing `tasks`, `planner_items`, or any other
skill's table.

## Refusal patterns
- `generate_learning_roadmap` must only reorder courses that actually
  exist in `planned`/`in_progress` status — must not invent a course the
  user hasn't added, and must not claim a rationale grounded in course
  content it never actually read (the prompt only gives it title +
  provider, not the course's real syllabus — the rationale must stay at
  that level of generality, not fabricate specifics about a course's
  content).
- Must not mark a course/certification done without an explicit user
  signal that it's actually complete — these are user-asserted facts
  (there's no external verification), so the agent should not proactively
  mark something done based on inference (e.g. "you mentioned finishing
  chapter 10, I'll mark the whole course done").
- Must not fabricate a certification's issuer or a course's provider if
  the user didn't state one — leave null.

## Known risk notes
- `generate_learning_roadmap` calls `get_gemini_client()` directly
  (`gemini-2.5-flash`, hardcoded) rather than going through the
  multi-provider fallback router (`app/core/model_router.py`) that every
  other LLM-backed helper in this codebase uses — meaning this specific
  tool has **no fallback** if Gemini is rate-limited/unavailable; it
  returns a plain `{"error": "Failed to generate a roadmap — try again."}`
  in that case (see the `except Exception` block) rather than crashing,
  but it will fail outright under the same Gemini free-tier quota
  exhaustion documented elsewhere in this project until it's migrated to
  `complete_with_fallback`.
- No externally-ingested untrusted content in this skill's own tools —
  course/cert titles and revision notes are first-party user input, not
  fetched/uploaded external documents (contrast with Knowledge Base and
  News).
