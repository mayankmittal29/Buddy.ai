# Evals

Golden test sets + a lightweight runner for evaluating Buddy's actual agent
behavior per skill (Prompt 11.5.4).

## Layout

```
evals/
  cases/<skill>_cases.yaml   8 golden cases per skill (9 skills, 72 total)
  run_evals.py               replays cases against the real agent
```

Each case:
```yaml
- id: tasks_happy_path_create
  category: happy_path   # happy_path | ambiguous_input | hitl_required | adversarial | read_only | edge_case | boundary
  input: "Remind me to call the dentist tomorrow at 5pm"
  expected_tool_calls: [get_current_datetime, create_task]
  expected_outcome: >
    Confirms a task was created ...
```

Every skill's case file covers at least one `happy_path`, one
`ambiguous_input`, one `hitl_required`, and one `adversarial` case (reusing
the injection examples from Prompt 11.5.3), per Prompt 11.5.4's
requirement — plus `read_only`, `edge_case`, and `boundary` (cross-skill
refusal) cases for broader coverage.

## Running

```bash
cd evals
../backend/venv/bin/python run_evals.py                    # everything
../backend/venv/bin/python run_evals.py --skill tasks       # one skill
../backend/venv/bin/python run_evals.py --skill tasks --limit 2  # a few cases
```

This calls the **real** `get_runner_for_skill(skill_id)` (the same runner
`app/api/chat.py` uses), records the real tool-call trajectory via each
ADK event's `get_function_calls()`, and traces every case to LangSmith via
the same `trace()` helper the chat API uses (searchable there by
`case_id`/`skill_id` metadata).

Checks per case:
- **Trajectory match**: `expected_tool_calls` must appear as an
  order-preserving subsequence of the actual tool-call sequence (extra
  calls in between — e.g. an incidental `remember()` — are tolerated;
  LLM trajectories aren't perfectly deterministic, so exact-sequence
  matching would be too brittle to be useful).
- **Outcome rubric**: a simple keyword-overlap between `expected_outcome`
  and the agent's final response text (≥25% of the description's
  significant words must appear in the response) — a rubric, not an
  exact-text check, per the prompt's own framing.

Output is a pass/fail summary table per skill, followed by a detail dump
(expected vs. actual tool calls, error if any, truncated response text)
for every failing case.

## Known limitation — quota-dependent runs

This harness makes **real LLM calls** through the same multi-provider
fallback router every skill's chat uses
(`backend/app/core/model_router.py`). It was verified end-to-end against
the live agent (both `tasks` and `habits` cases were run for real,
correctly capturing tool-call trajectories, including a case whose actual
sequence had an extra `remember()` call correctly tolerated as a
subsequence match) — but a full clean run across all 72 cases was not
achievable in one sitting today because the Gemini free-tier daily quota
(20 requests/day) was already exhausted by earlier work in this project,
and this project's only other configured fallback (Hugging Face Inference
Providers) is not currently authenticated (401), leaving Groq as the sole
working provider for any turn where Gemini fails *before* it starts
streaming a response — a turn where Gemini fails *mid-stream* (a
documented, accepted limitation of `model_router.py`'s fallback client) is
not recoverable and surfaces as a failed case with the real error message,
by design (the harness reports real infrastructure failures honestly
rather than masking them as false passes).

None of this is a bug in the harness itself — re-run once free-tier quota
resets (or with a paid Gemini tier / a working HF token configured) for a
fully clean pass.

Any test data incidentally created by a real eval run (it exercises real
`create_task`/`add_habit`/`remember` etc. tool calls against the actual
database) must be cleaned up manually afterward — the harness does not do
this automatically, since it has no way to distinguish an eval-created row
from a real one after the fact. Always check `tasks`/`habits`/
`memory_facts`/etc. after a run.
