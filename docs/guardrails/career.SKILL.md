# Career — Guardrail Spec

## Purpose
Track job applications through their pipeline (just found → applied →
interview → offer/rejected/withdrawn) and check an uploaded resume's
keyword overlap against a pasted/uploaded job description.

## Allowed tools
Cross-checked against `app/skills/career/tools.py`.

Universal (every skill): `remember`, `recall`, `get_skill_instructions`

Career-specific:
- `list_resumes()` — read-only.
- `skill_gap_analysis(resume_id, jd_text)` — read-only (downloads and
  parses the resume file, compares keywords; persists nothing).
- `list_job_applications(status)` — read-only.
- `add_job_application(company, role, ctc, source_link, referral_taken_by,
  hr_contact, notes)` — write.
- `update_job_application_status(application_id, status)` — write (status
  change only).

Note: resume file upload/delete and JD PDF/image text extraction
(`/api/career/resumes`, `/api/career/extract-jd-text`) are REST-only
(`app/api/career.py`) — not exposed as agent tools. The agent can list and
analyze resumes, but cannot upload, replace, or delete one on the user's
behalf.

## Zero Ambient Authority statement

**Requires HITL confirmation before executing:** none of the current
agent tools delete anything. Resume deletion (`DELETE
/api/career/resumes/{id}`, which also calls Cloudinary/R2 `destroy()`) is
REST-only and not chat-reachable at all today — so there is currently no
agent-triggerable destructive action in this skill. If an
`delete_job_application` or `delete_resume` tool is ever added, it must be
added here as HITL-required, matching `tasks.delete_task`.

**Safe to auto-execute:**
- `list_resumes`, `list_job_applications`, `skill_gap_analysis` — all
  read-only.
- `add_job_application` — additive, non-destructive, matches the
  "additions don't need confirmation" convention used elsewhere.
- `update_job_application_status` — non-destructive status change; moving
  an application backward/forward in the pipeline is easily corrected.

## Data boundaries

**Reads:**
- `resumes`, `job_applications` (own tables).
- Resume file bytes are downloaded from `resume.file_path` (an external
  Cloudinary/R2 URL) via `_download_file` — not a DB read, but worth
  naming as an external fetch this skill's tools perform.

**Writes:**
- `job_applications` (own table) only, via `add_job_application` /
  `update_job_application_status`.

**Cross-skill touches to flag in review:** none currently. A violation
would be any Career tool reading/writing `documents`/`document_chunks`
(Knowledge Base — note the *conceptual* overlap: resumes and JD text are
"documents" in the colloquial sense, but they live in the `resumes` table
and an ephemeral `jd_text` string, never in Knowledge Base's
`documents`/`document_chunks` tables; keep it that way — a resume should
never get silently ingested into the KB semantic index by a shared
helper).

## Refusal patterns
- **Must refuse to invent resume content the user didn't provide.**
  `skill_gap_analysis` only ever reports keyword overlap computed from the
  actual extracted resume/JD text (`_tokenize`) — the agent must not pad a
  low match percentage by claiming skills/experience aren't actually in
  the resume file, and must not suggest specific resume wording changes as
  if they were already present.
- Must not fabricate a CTC, referral name, or HR contact the user didn't
  state — leave these fields null rather than guessing plausible values.
- Must not claim an application's status changed without a confirmed
  `update_job_application_status` call.
- `skill_gap_analysis`'s own docstring already frames it correctly: "This
  is a simple keyword-overlap check, not a real ATS score" (also shown
  verbatim in the frontend UI) — the agent must not oversell the result as
  an authoritative hiring-chance assessment.

## Known risk notes
- `skill_gap_analysis` accepts arbitrary `jd_text` — this is
  user/agent-ingested external content (a job description, possibly
  pasted from an external site or OCR'd from an image) that later appears
  in the tool's output (`missing_keywords`, etc.) and could be echoed back
  into the conversation. Per Prompt 11.5.3, JD text should be treated as
  untrusted content and run through `sanitize_external_content()` before
  being used in the keyword-overlap prompt/response path, the same as News
  and Knowledge Base's ingested content — a pasted JD is exactly the kind
  of external text an adversarial actor (e.g. a scraped/forwarded fake job
  posting) could embed injected instructions into.
- Resume files are fetched from whatever URL is stored in
  `resume.file_path` — this is populated exclusively by the app's own
  upload flow (Cloudinary/R2), never user-suppliable at request time, so
  it is not an open SSRF vector today; keep it that way if this tool is
  ever changed to accept a URL directly from chat.
