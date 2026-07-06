# Finance — Guardrail Spec

## Purpose
Let the user log expenses, track budgets and subscriptions, check
budget-vs-spend status, and get a monthly spending summary conversationally
— routed entirely through a dedicated external MCP server rather than
direct database access from agent tool code.

## Allowed tools
Cross-checked against `app/skills/finance/tools.py` (which registers only
an `McpToolset`, no plain Python tools) and
`mcp-servers/buddy-mcp/server.py` (the actual tool implementations it
discovers at runtime).

Universal (every skill): `remember`, `recall`, `get_skill_instructions`

Finance-specific (all served by the `buddy-mcp` MCP server over stdio,
never called directly from `app/skills/finance/tools.py`):
- `add_expense(amount, category, note)` — write.
- `get_expense_summary(month)` — read-only.
- `check_budget_status(category)` — read-only.
- `add_subscription(name, amount, cycle)` — write.
- `get_savings_progress(goal_id)` — read-only.
- `get_monthly_insights()` — read-only (also makes an LLM call via
  `complete_with_fallback`, see risk notes).

**Important gap to note, not a violation**: `SavingsEntry` (the "Savings"
ledger panel added to the Finance page — name/amount/date/notes) has REST
CRUD (`app/api/finance.py`) but **no corresponding MCP tool**. The agent
cannot log, list, or edit a savings entry conversationally today — only
via the UI form directly. If a `log_savings_entry`-style MCP tool is added
later, it must be added to this doc and to `buddy-mcp/server.py` together
(this doc's tool list is only accurate as long as it's cross-checked
against that file whenever it changes).

## Zero Ambient Authority statement

**Requires HITL confirmation before executing:** none of the current MCP
tools delete anything — there is no `delete_expense`/`delete_subscription`
MCP tool (those exist as REST-only endpoints in `app/api/finance.py`, not
chat-reachable). If a delete-capable MCP tool is added, it must require
confirmation the same way `tasks.delete_task` does.

**Safe to auto-execute:**
- `get_expense_summary`, `check_budget_status`, `get_savings_progress`,
  `get_monthly_insights` — all read-only.
- `add_expense`, `add_subscription` — additive; matches this project's
  "additions don't need confirmation" convention (e.g. the SKILL.md
  instruction to log an expense like "spent 400 on food today" directly,
  inferring a category rather than blocking on it).

## Data boundaries

**Reads:**
- `expenses`, `budgets`, `subscriptions`, `savings_goals` — via the MCP
  server's own SQLAlchemy session (`AsyncSessionLocal`, imported by adding
  `backend/` to `sys.path` — see `mcp-servers/buddy-mcp/server.py`'s module
  docstring). Same DB, same models, separate process.
- `savings_entries` — REST-only, not tool-reachable (see gap above).

**Writes:**
- `expenses`, `subscriptions` (own tables) only, via `add_expense` /
  `add_subscription`.

**Cross-skill touches to flag in review:** none. The MCP server imports
`app.core.db`/`app.core.models` from the backend, which is a code-sharing
convenience, not a data-boundary violation — it never touches
`tasks`/`courses`/`habits`/any other skill's tables. A real violation
would be a Finance MCP tool reading/writing any table outside
`expenses`/`budgets`/`subscriptions`/`savings_goals`.

## Refusal patterns
- **Must refuse to fabricate transaction data.** Every number
  `get_expense_summary`/`get_monthly_insights` reports must come from an
  actual `expenses`/`budgets` row — never estimate "you probably spent
  around X" when the tool returns zero/partial data.
- **Must refuse to guess an account number, card number, or any banking
  credential** — this skill has no such fields in its schema at all
  (`Expense`/`Budget`/`Subscription`/`SavingsGoal` store amounts and
  categories, never account identifiers); if a user asks the agent to
  "remember my account number," the agent must decline, not store it via
  `remember` either (see `docs/guardrails/ROOT_AGENT.md`'s "no secrets"
  rule).
- Must not claim a budget exists for a category when
  `check_budget_status` returns `monthly_limit: null` — say plainly that
  no budget is set, per that tool's own docstring.
- `get_monthly_insights` must never fall back to inventing a plausible
  scenario when the real data is all-zero — this was a real, observed bug
  (an earlier version of the underlying prompt caused the model to
  hallucinate a fake "$4,500 rent/dining" scenario against genuinely empty
  data) fixed by short-circuiting to a fixed "No expenses logged yet this
  month" string when `total_spend == 0`, bypassing the LLM call entirely
  in that case (`app/common/finance.py:get_monthly_insights`). Any future
  change to this function must preserve that short-circuit.

## Known risk notes
- **Real-world side effects**: this is one of the two skills (with
  Notifications) flagged in the STRIDE threat model
  (`docs/guardrails/THREAT_MODEL.md`) for handling data the user would
  reasonably consider sensitive/financial, even though no external
  transfer or payment capability exists anywhere in this codebase — all
  "expenses" are user-entered records, not connections to a real bank.
- **Separate-process trust boundary**: the MCP server is a distinct OS
  process spawned via stdio (`StdioServerParameters`, `app/skills/finance
  /tools.py`) — anything that can influence its command/args/cwd or the
  content of what's piped to its stdin is a more serious compromise than a
  bug in an in-process tool function. Today those parameters are all
  hardcoded (`sys.executable`, a fixed path, `BACKEND_DIR`) with no
  user-influenced input, so this is a contained, low-risk design as long
  as that stays true.
- `get_monthly_insights` calls `get_gemini_client().aio.models
  .generate_content(model="gemini-2.5-flash", ...)` **directly**
  (`app/common/finance.py`), unlike News/Knowledge Base/Analytics's LLM
  calls which go through the multi-provider fallback router
  (`app/core/model_router.py:complete_with_fallback`). This means a
  Gemini-specific outage/quota exhaustion has no fallback provider here —
  it's caught by a bare `except Exception` around the call and degrades to
  the fixed non-LLM summary sentence described above, so it fails safe
  (no crash, no hallucination) but not gracefully (no other provider is
  tried first). Migrating this call to `complete_with_fallback("finance",
  ...)` would remove that single-provider dependency and is a reasonable
  hardening follow-up, not required by this pass.
