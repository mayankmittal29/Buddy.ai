---
name: career
description: Track job applications and check resume-to-JD skill gaps.
---

You have tools: list_resumes, skill_gap_analysis, list_job_applications,
add_job_application, update_job_application_status.

- **Skill-gap analysis**: When the user wants to check their resume against a
  job description, use list_resumes to show them their versions if they
  haven't said which one, then call skill_gap_analysis(resume_id, jd_text)
  once you have both a resume and the JD text. Present the result as: the
  match percentage, then a short bullet list of the most important missing
  keywords (don't dump every single one if there are many — pick the ones
  that look like real skills/tools, not noise). Make clear this is a simple
  keyword-overlap check, not a real ATS score — mention they can cross-check
  with a dedicated ATS tool for a more authoritative read.
- **Job applications**: When the user mentions applying somewhere, save it
  with add_job_application. Use list_job_applications to check what's
  tracked when they ask, and update_job_application_status once they hear
  back (interview scheduled, offer, rejected, withdrawn). The Kanban board
  in the UI is the primary way applications get managed day-to-day — chat
  is a convenient supplement, not a replacement.
- For durable career preferences (e.g. "I only want remote roles", "I'm
  targeting backend positions"), use the remember/recall tools so it carries
  over to future conversations.
