# CLAUDE.md — Buddy Project Memory

This document is the permanent reference for the Buddy codebase. It should let any
engineer (human or AI) understand the entire system — what it does, how it's built, why
it's built that way — without needing to ask clarifying questions first.

---

## 1. Project Overview

**Buddy** is a personal concierge agent: one conversational AI assistant that replaces
nine separate productivity apps. It's built on **Google's Agent Development Kit (ADK)**
as a single root agent that loads a different "skill" (its own tools, prompt, and data
boundary) depending on what the user is doing, rather than running nine independent
bots.

The nine skills: **Planner**, **Tasks**, **News**, **Career**, **Learning**, **Finance**,
**Habits**, **Knowledge Base**, **Analytics**. Each solves a specific manual-tracking
pain point (see `writeup.txt` / `kaggle_writeup.txt` at the repo root for the full
pain-point-by-pain-point pitch if you need product framing).

The build treats safety, evaluation, and observability as first-class engineering
concerns rather than afterthoughts:
- Every consequential agent action (deleting data, sending a notification) requires
  explicit human confirmation (Zero Ambient Authority).
- PII is redacted before anything is persisted to long-term memory.
- Content ingested from external sources (news, uploaded documents) is sanitized
  against prompt injection before it ever reaches the LLM.
- A tool-call interception layer (`Agent Hooks`) enforces per-skill tool allow-lists on
  every single tool invocation.
- A golden-case evaluation harness checks tool-call trajectories, not just final answers.
- Every model call goes through a tiered, multi-provider fallback router so a single
  provider's rate limit degrades gracefully instead of breaking the product.

**Scope boundary to understand immediately:** the app has real user *accounts*
(signup/login via a `users` table), but the underlying product data (tasks, habits,
finance, etc.) is still a **single-user schema** — there is no per-account `user_id`
scoping anywhere except the auth tables themselves. Every task/habit/expense/etc. in the
database belongs to "the one user of this deployment," not to a specific logged-in
account. See §9 (Authentication Flow) and §16 (Known Limitations) for what this means in
practice.

Two things were deliberately scoped **out**, not overlooked:
- **Agent-to-Agent (A2A) orchestration** — Buddy is one agent with skills, not a
  multi-agent system. See §5 for the reasoning.
- **A2UI (agent-generated interface)** — the frontend is hand-built against a design
  spec, not generated/adapted by the agent.

---

## 2. Folder Structure

```
buddy/
├── backend/                       FastAPI + Google ADK backend
│   ├── app/
│   │   ├── api/                   REST routers (one file per skill/concern)
│   │   ├── common/                Shared business logic + cross-cutting utilities
│   │   ├── core/                  Agent wiring, DB engine, config, security, model router
│   │   ├── skills/                One folder per skill: SKILL.md (+ optional tools.py)
│   │   └── main.py                FastAPI app: router registration, CORS, lifespan
│   ├── alembic/                   DB migrations (versions/ = one file per schema change)
│   ├── tests/                     pytest unit tests (PII, injection guard, agent hooks, notifications)
│   ├── data/                      ADK's own SQLite session store (sessions.db) — gitignored
│   ├── requirements.txt
│   ├── pytest.ini
│   └── README.md                  Model-router deep dive (tiers, fallback, debugging)
│
├── frontend/                      React 19 + TypeScript + Vite
│   └── src/
│       ├── pages/                 Route-level components (incl. pages/auth/, pages/skills/)
│       ├── components/            One folder per skill + layout/, ui/ (shadcn primitives),
│       │                          auth/, workspace/ (shared 3-pane chat shell), notifications/
│       ├── stores/                zustand stores: authStore, themeStore
│       ├── lib/                   Shared utilities: styles.ts, utils.ts, toast.tsx, date.ts,
│       │                          datetime.ts, fuzzy.ts
│       ├── config/skills.ts       Single source of truth for the 9 skills' nav metadata
│       ├── App.tsx                Route tree, auth gating, global <Toaster/>
│       └── main.tsx               Entry point (BrowserRouter + App)
│
├── mcp-servers/
│   └── buddy-mcp/                 Standalone MCP server exposing Finance as MCP tools
│
├── docs/guardrails/                Per-skill security specs + ROOT_AGENT.md + THREAT_MODEL.md
├── evals/                          Golden-case evaluation harness (per-skill YAML + runner)
├── assets/                         README/writeup marketing images (source of frontend's copies)
├── .secrets.baseline               detect-secrets baseline (reviewed false positives only)
├── .semgrep.yml / .semgrepignore    Custom static-analysis rules
├── .pre-commit-config.yaml         Commit-time hooks (lint, format, secrets, semgrep)
├── Makefile                        `make security-scan`
├── docker-compose.yml              Local Postgres+pgvector only (no app containers)
├── .env.example                    All environment variables, documented inline
└── README.md                       Setup instructions + architecture diagrams
```

---

## 3. Complete Architecture

```
User (browser)
  │
  ▼
React SPA (Vite dev server :5173 / static build)
  │  fetch() with credentials:"include" (cookies)
  ▼
FastAPI backend (:8000)
  │
  ├── REST routers (app/api/*.py) ── plain CRUD over Postgres, per skill
  │
  ├── /api/skills/{skill_id}/chat ── SSE streaming chat endpoint
  │     │
  │     ▼
  │   ADK Runner (per-skill, cached) ── google.adk.runners.Runner
  │     │
  │     ├── Agent clone (root_agent.model_copy(deep=True) + skill's own tools.py)
  │     │     │
  │     │     ├── before_tool_callback = check_tool_call        (Agent Hooks)
  │     │     ├── after_tool_callback  = record_tool_result      (Agent Hooks)
  │     │     └── tools: [remember, recall, get_skill_instructions, <skill-specific>...]
  │     │
  │     ├── Model: FallbackLiteLLMClient (Groq → Gemini → HF Inference Providers)
  │     │
  │     └── Session state: ADK's own SQLite store (backend/data/sessions.db)
  │           — separate from Postgres; short-term scratchpad only
  │
  ├── APScheduler background jobs (app/common/scheduler.py)
  │     — task reminders, course deadlines, habit milestones, daily news digest
  │     — writes Notification rows + optionally sends email (never chat-triggered)
  │
  └── buddy-mcp (separate OS process, stdio) ── Finance's tools only, via ADK's McpToolset
        — talks directly to the same Postgres DB via app.common.finance

Postgres (pgvector extension)
  — durable app data: 28 tables across auth, cross-skill, and all 9 skills
  — memory_facts + document_chunks store pgvector embeddings (768-dim, Gemini)

External services (all optional/best-effort):
  Gemini, Groq, Hugging Face Inference Providers  — chat models + embeddings
  Gmail SMTP                                      — outbound notification emails
  Cloudinary                                      — images (avatars, cert files, some resumes)
  Cloudflare R2                                   — PDF resumes (inline-preview-friendly URLs)
  LangSmith                                       — tracing/observability
```

**Two session/state stores exist and serve different purposes — don't confuse them:**
1. **Postgres** (`conversations`/`messages` tables) — the durable, user-facing chat
   history shown in the UI.
2. **ADK's SQLite store** (`backend/data/sessions.db`, via `DatabaseSessionService`) —
   ADK's own internal turn-by-turn scratchpad/state (`session.state`, e.g. the
   `active_skill` key set per turn). Ephemeral in spirit even though it's on disk;
   never queried directly by any API route.

---

## 4. Technology Stack

**Backend**
| Concern | Choice |
|---|---|
| Web framework | FastAPI (async), Uvicorn |
| Agent framework | Google ADK (`google-adk`) |
| Model access | `litellm` (provider-agnostic completion calls) |
| DB / ORM | PostgreSQL + `pgvector`, SQLAlchemy 2.0 (async), Alembic migrations |
| Auth | `PyJWT` (access tokens), `argon2-cffi` (password hashing), stdlib `secrets`/`hashlib` (opaque refresh/reset tokens) |
| Scheduling | APScheduler (`AsyncIOScheduler`) |
| Tracing | LangSmith |
| Document/file handling | `pdfplumber`, `python-docx`, `reportlab`, `defusedxml`, `beautifulsoup4`, `lxml` |
| Object storage clients | `cloudinary`, `boto3` (R2, S3-compatible) |
| MCP | `mcp` (Python SDK), custom `buddy-mcp` server |
| Testing | `pytest`, `pytest-asyncio` |

**Frontend**
| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript, Vite 6 |
| Styling | Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`), shadcn/ui (neutral theme) built on Base UI primitives |
| Routing | React Router v7 |
| State | `zustand` (`authStore`, `themeStore`) |
| Notifications | `react-hot-toast`, wrapped in `src/lib/toast.tsx` |
| Charts | `recharts` (Analytics dashboard) |
| Icons | `lucide-react` |
| Fonts | Geist Variable (sans), Caveat Variable (script/heading accents) via `@fontsource-variable` |

**Infra / tooling**
| Concern | Choice |
|---|---|
| Local DB | Docker Compose, `pgvector/pgvector:pg16` image |
| Static analysis | Semgrep (registry packs + 3 custom rules), isolated in `.tools/semgrep-venv` |
| Secret scanning | `detect-secrets`, baseline at `.secrets.baseline` |
| Formatting/linting | `black`, `ruff` (lint + import-sort), `oxlint` (frontend) |
| Git hooks | `pre-commit` |
| Evaluation | Custom pytest-adjacent harness (`evals/run_evals.py`) over per-skill YAML cases |

---

## 5. Design Decisions and Rationale

**One root agent with nine skills, not nine agents.** Rejected a multi-agent (A2A)
design for concrete reasons:
- Memory needs to be *shared*, not passed around — one `remember`/`recall` pair over
  one long-term store beats an inter-agent messaging protocol for keeping facts in sync.
- **Progressive Disclosure** already buys the context-isolation that multi-agent designs
  exist to provide: `get_agent_for_skill()` clones `root_agent` and attaches only that
  skill's `tools.py`, so a skill's tools/prompt only load when active — without paying
  for a manager-agent's routing hop.
- The 9 domains don't coordinate with each other in real time (Finance never "asks"
  Planner anything mid-task) — there's no real coordination problem to solve.
- One agent means Agent Hooks (see §8) are wired **once** and inherited by every skill's
  clone, instead of 9x the surface area to keep secure.
- Fewer model calls per turn = real cost/latency savings under free-tier quotas.

**Progressive Disclosure for skills.** `app/skills/loader.py` reads only each
`SKILL.md`'s YAML frontmatter (`name`/`description`) at startup — that's what's baked
into the system prompt. The full instructions body is only read when the agent calls
`get_skill_instructions(skill_id)`, once it's decided (from the one-line description)
that a skill is relevant. This keeps every turn's context small regardless of how many
skills exist.

**Per-skill tool scoping via deep-copied agent clones**, not a single shared agent with
every tool loaded. `root_agent.model_copy(deep=True)` in `get_agent_for_skill()` — a
Finance conversation's agent literally does not have Tasks' `delete_task` tool in its
tool list; it's not just prompted not to use it.

**Multi-provider model routing** (`app/core/model_router.py` + `model_tiers.py`)
instead of one hardcoded model. Skills are grouped into 3 tiers by workload shape (fast/
simple, tool-calling-heavy, long-context), each tier an ordered Groq → Gemini → Hugging
Face chain. `FallbackLiteLLMClient` walks the chain on rate-limit/auth/availability
errors. **Known, accepted limitation:** a provider that fails *mid-stream* (after
accepting the request) is not recovered from — only a pre-stream failure triggers
fallback. Recovering a partial stream would need buffering/re-emission, judged not worth
the complexity for how rarely it happens vs. pre-stream 429s.

**MCP for tool standardization**, not ad-hoc function calling everywhere. Finance is the
one skill served entirely through a real, separate MCP server (`buddy-mcp`, stdio
transport, spawned by ADK's `McpToolset`) rather than plain Python functions — this is
deliberately the "MCP done for real" showcase skill.

**Two-tier memory.** Short-term: ADK's own SQLite session store (turn history,
`session.state`). Long-term: `memory_facts` table in Postgres with `pgvector` cosine-
distance search, written/read via the universal `remember`/`recall` tools available to
every skill's agent. A fact learned under one skill is recallable under any other — an
intentional product decision (memory is a cross-cutting user model), not a leak.

**Guardrails as enforced code, not prompt-only conventions** (§8). Writing a SKILL.md
that says "ask before deleting" is easy to ignore; `agent_hooks.py`'s `before_tool_callback`
actually blocks the call if confirmation language isn't in the user's current message.

**Auth is a login gate, not a multi-tenancy rewrite.** Adding real accounts could have
meant scoping every one of the other 25 tables with a `user_id` FK and rewriting every
query in every skill. That's a fundamentally different, much larger project than "add
signup/login" — so `users` backs real authentication, while tasks/habits/finance/etc.
remain the single-user schema they always were. This is a deliberate, documented scope
boundary (see §16), not an oversight.

**Theme palettes are custom CSS, not the literal `daisyui` Tailwind plugin.** DaisyUI
ships its own component classes (`.btn`, `.card`, `.input`, `.modal`, ...) that would
collide with class names already used throughout this app's existing shadcn/ui
components. Instead, 8 palettes (Light, Dark, Dracula, Synthwave, Forest, Corporate,
Luxury, Cupcake) are implemented as `[data-theme="x"] { --var: ...; }` CSS blocks
overriding the *same* CSS custom properties shadcn's components already read, swapped at
runtime via a `data-theme` attribute on `<html>` and persisted through `zustand`.

**Toast notifications wrapped in one module** (`frontend/src/lib/toast.tsx`) rather than
calling `react-hot-toast` directly at ~50 call sites. `showSuccess`/`showError` render
custom JSX (icon + message + close button) via `toast.success/error`'s render-function
form, and force a consistent 3s duration regardless of what a call site passes — one
place controls how every notification in the app looks and behaves.

---

## 6. Backend Flow

### Startup (`app/main.py`)
1. `load_skills(root_agent)` — wires `get_skill_instructions` onto the root agent and
   appends the skill menu to its system prompt.
2. FastAPI app created with a `lifespan` context manager that calls `start_scheduler()`
   on startup and `stop_scheduler()` on shutdown.
3. CORS middleware allows only `http://localhost:5173`, `allow_credentials=True`
   (required for the auth cookies to work cross-origin in dev).
4. 15 routers included (see §7 for the full endpoint list).

### A chat turn (`app/api/chat.py`)
1. `POST /api/skills/{skill_id}/chat` validates `skill_id` exists, gets-or-creates a
   `Conversation` row, persists the user's `Message`.
2. Returns a `StreamingResponse` (SSE, `text/event-stream`) backed by `_stream_chat()`.
3. `_stream_chat` gets/creates an ADK session keyed `f"{skill_id}:{conversation_id}"`,
   fetches that skill's on-demand instructions directly (rather than making the model
   call `get_skill_instructions` itself — the route already knows the skill), and builds
   a `types.Content` with two parts: the skill-scoping preamble + the user's raw message.
4. `request_key_var.set(session_id)` — lets the model router record which
   tier/provider/model ends up serving this turn (for LangSmith metadata), set *before*
   `runner.run_async()` so it's visible to whatever child task ADK spawns internally.
5. Streams `event.content.parts` as SSE `delta` events while `event.partial`, buffers the
   final non-partial chunks, wraps the whole call in a LangSmith `trace("buddy_chat", ...)`.
6. On success: persists the assistant `Message`, fires-and-forgets a title
   re-summarization (`_maybe_refresh_title`, capped at 10 exchanges), yields a `final`
   event then `done`.
7. On any exception during the run: yields an `error` event with the exception string,
   then `done` — no assistant message is persisted for a failed turn.

### Every tool call, regardless of skill (`app/core/agent_hooks.py`)
Wired once onto `root_agent` via ADK's native `before_tool_callback`/
`after_tool_callback`; every skill's cloned agent inherits both (function references
survive `model_copy(deep=True)`).

- **`check_tool_call`** (before): (a) is this tool in the active skill's static
  allow-list (`ALLOWED_TOOLS`) — Finance is explicitly exempted since its tools are
  MCP-discovered at runtime, not statically enumerable; (b) does this tool
  (`HITL_REQUIRED_TOOLS` — currently just `tasks.delete_task`) need explicit user
  confirmation, checked via a regex over the current turn's user text
  (`yes|confirm|go ahead|...`); (c) neutralize injection-guard patterns in every string
  argument in place (doesn't block the call — a legitimate "store this odd-looking text"
  request must still succeed).
- **`record_tool_result`** (after): redacts PII recursively from the tool's response
  before it re-enters the model's context; logs tool name, skill_id, redacted args,
  success/failure, and PII-redaction count to LangSmith as a structured child trace.

### Background jobs (`app/common/scheduler.py`, `APScheduler`)
| Job | Interval | Effect |
|---|---|---|
| `check_due_tasks` | every 1 min | `Notification` + optional email for tasks due within 10 min; rolls recurring tasks forward |
| `check_course_deadlines` | every 60 min | `Notification` + optional email for courses due within 1 day |
| `check_inactive_learning_items` | every 60 min | `Notification` per stalled course/cert (10+ days untouched) + one combined email digest |
| `check_habit_milestone` | called inline from the habit-toggle endpoint, not on a timer | `Notification` + optional email on hitting a 10/30/50/100-day streak |
| `run_daily_news_job` | daily, cron hour 7 | Generates the digest, `Notification` + optional email, purges news older than 3 days (starred exempt) |

All emails go through `send_email_guarded` (PII-scanned; withheld + logged if unexpected
PII found) and are gated on `NotificationPreferences.channels["email"]` being explicitly
opted into — **no chat tool in any skill can trigger an email directly**; only these
scheduler jobs can.

---

## 7. Frontend Flow

### App shell (`src/App.tsx`)
- A global `<Toaster position="top-center" containerClassName="buddy-toaster-root">` is
  mounted once, plus a `document.mousedown` listener that calls `toast.dismiss()` when a
  click lands outside `.buddy-toaster-root` (click-outside-to-dismiss).
- Route tree: `/login`, `/signup`, `/forgot-password` are wrapped in `RedirectIfAuthed`
  (bounces to `/` if already authenticated); `/reset-password` is unwrapped (accessible
  regardless of auth state, since a reset-link click shouldn't be blocked by a stale
  session); everything else is nested under a single `path="/*"` route wrapped in
  `RequireAuth`.
- `RequireAuth` calls `authStore.initAuth()` once (on `status === "idle"`), shows a
  full-screen spinner while `loading`, redirects to `/login` (preserving the attempted
  path in router state) if `unauthenticated`, else renders the real app shell
  (`Navbar` + nested `<Routes>` for Home/Profile/Settings/Notifications/each skill page).

### Auth bootstrap (`src/stores/authStore.ts`)
`initAuth()`: try `GET /api/auth/me` (cookie-authenticated) → if it 401s, try one
`POST /api/auth/refresh` → if that succeeds, retry `/me`. This is what makes a page
reload survive: the access-token cookie (15 min) may have expired, but the refresh-token
cookie (30 days) is still good, so one silent refresh round-trip re-establishes the
session without the user noticing.

### A skill's chat page
Each `pages/skills/*Skill.tsx` composes `WorkspaceLeftPanel` / `WorkspaceCenterPanel` /
`WorkspaceRightPanel` (`components/workspace/Workspace.tsx`) around a shared
`ChatPanel` (`components/workspace/ChatPanel.tsx`):
- Conversation ID is either self-managed (`localStorage`, key
  `buddy:conversation:{skillId}`) or lifted to a parent (skills with their own
  conversation-list sidebar pass `conversationId`/`onConversationIdChange`).
- Sends messages via `fetch(...).body.getReader()` (manual SSE parsing — not
  `EventSource`, since the endpoint is a POST with a JSON body, which `EventSource`
  can't do), rendering `delta` events as streamed tokens.
- Replies ending in a `Sources: Title One, Title Two` line (Knowledge Base's
  `answer_from_documents` convention) get that line split off and rendered as reference
  chips instead of raw trailing text.

### Data fetching convention
No global API client/axios instance — every skill has its own `components/<skill>/api.ts`
with plain `fetch(`${API_URL}/api/...`)` calls, typed request/response interfaces, and
(for Finance specifically) a small local `get()`/`send()` helper. Mutating calls
(create/update/delete/upload) all follow the same pattern established this session:

```ts
async function handleX(...) {
  try {
    await someMutation(...)
    await refresh()               // whatever follow-up already existed
    showSuccess("Short past-tense message.")
  } catch (err) {
    showError(err instanceof Error ? err.message : "Couldn't <do the thing>.")
    throw err                      // rethrow — callers' existing try/finally still fires
  }
}
```

### Styling conventions (`src/lib/styles.ts`)
Shared Tailwind class-string constants used everywhere instead of ad hoc repetition:
`cardBase`, `cardHover`, `pageShell`, `pillBase`, `sectionGap`, `transitionBase`. All
color/spacing tokens come from CSS custom properties declared in `src/index.css`
(`--color-canvas`, `--color-surface`, `--color-primary-50`, `--shadow-card`, etc.) —
**never hardcode a hex color in a component**; add/override the CSS variable instead so
theme switching (§5) keeps working.

---

## 8. API Endpoints

All routers are included in `app/main.py`. Prefix shown once per router; `{id}` params
are integers unless noted.

**Auth** (`app/api/auth.py`, prefix `/api/auth`)
| Method | Path | Notes |
|---|---|---|
| POST | `/signup` | Creates account only — 201, no cookies set |
| POST | `/login` | Sets access+refresh cookies |
| POST | `/refresh` | Rotates refresh token, reissues both cookies |
| POST | `/logout` | Revokes the refresh token, clears cookies |
| GET | `/me` | Current user from access-token cookie |
| POST | `/forgot-password` | Always-generic response; emails a reset link if the username is email-shaped and exists |
| POST | `/reset-password` | Consumes token, revokes all refresh tokens for that account |

**Chat & conversations**
| Method | Path | Notes |
|---|---|---|
| POST | `/api/skills/{skill_id}/chat` | SSE stream |
| POST | `/api/skills/{skill_id}/conversations` | |
| GET | `/api/skills/{skill_id}/conversations` | |
| GET | `/api/skills/{skill_id}/conversations/{conversation_id}/messages` | |
| DELETE | `/api/skills/{skill_id}/conversations/{conversation_id}` | |

**Tasks** (`/api/tasks`) — GET, POST, PATCH `/{id}`, DELETE `/{id}`
**Planner** (`/api/planner`) — GET, POST, PATCH `/{id}`, DELETE `/{id}`, plus
`GET /daily-schedule`, `GET /export`, `GET /morning-briefing`, `GET /evening-review`
**Learning** (`/api/learning`) — `/courses`, `/certifications`, `/revision-items`, each
with GET/POST/PATCH `/{id}`/DELETE `/{id}` (+ certification file upload endpoint)
**Career** (`/api/career`) — `/resumes` (GET/POST/PATCH/DELETE + `/{id}/download`),
`/applications` (GET/POST/PATCH/DELETE), `/extract-jd-text`
**Habits** (`/api/habits`) — GET, POST, `/{id}/toggle`, `/{id}/streak`, DELETE `/{id}`
**Finance** (`/api/finance`) — `/expenses`, `/budgets`, `/subscriptions`,
`/savings-goals`, `/savings-entries` (all GET/POST/PUT `/{id}`/DELETE `/{id}`), plus
`/summary`, `/budget-status/{category}`, `/savings-goals/{id}/progress`, `/insights`
**News** (`/api/news`) — GET, PATCH `/{id}`, POST `/generate-digest`
**Knowledge Base** (`/api/knowledge`) — `/notes`, `/bookmarks` (GET/POST/PUT/DELETE),
`/documents` (GET/PATCH/DELETE + `/upload`)
**Analytics** (`/api/analytics`) — GET `/overview`, POST `/weekly-report`
**Profile** — GET/PUT `/api/profile`, POST `/api/profile/avatar`
**Notifications** — GET/PUT `/api/notification-preferences`, GET `/api/notifications`,
GET `/api/notifications/unread-count`, PATCH `/api/notifications/{id}`
**Debug** — GET `/api/debug/model-check/{skill_id}` (probes every provider in a skill's
tier live, reports ok/rate_limited/error per step)

Full request/response shapes: read each router file directly (Pydantic models are
defined right above their endpoints, not in a separate schemas module).

---

## 9. Authentication Flow

**Storage:** `users`, `refresh_tokens`, `password_reset_tokens` tables
(`app/core/models.py`). Passwords hashed with **Argon2** (`argon2-cffi`). Access tokens
are stateless **JWTs** (`PyJWT`, HS256, 15 min TTL, signed with `settings.jwt_secret`).
Refresh and password-reset tokens are **opaque random strings**
(`secrets.token_urlsafe(48)`) — only their **SHA-256 hash** is ever persisted, so a DB
leak doesn't hand out usable tokens, and unlike a JWT they're individually revocable
(checked against a live DB row, not just a signature+expiry).

**Cookies:** both tokens live in **HttpOnly, SameSite=Lax** cookies (`access_token`,
`refresh_token`) — never touched by frontend JS. `secure=False` currently (local HTTP
dev only — **flip to `True` before any real deployment**, alongside moving both
frontend and backend onto HTTPS).

**Signup does NOT log the user in.** `POST /api/auth/signup` creates the `User` row
(hashing the password, pre-filling the separate single-row `UserProfile.name` if blank)
and returns `201` with the user's data — **no cookies are set**. The frontend
(`Signup.tsx`) always navigates to `/login` afterward. This was an explicit later
requirement change (originally signup did auto-login; deliberately reversed).

**Login** (`POST /api/auth/login`): verifies password via Argon2, creates a
`RefreshToken` row, sets both cookies via `create_access_token()` +
`generate_opaque_token()`.

**Refresh rotation** (`POST /api/auth/refresh`): looks up the incoming refresh cookie's
hash, checks not revoked/expired, marks it `revoked=True`, issues a brand-new refresh
token + new access token. **Every refresh token is single-use** — reusing an old one
after it's been rotated fails.

**Forgot/reset password:** `forgot-password` always returns the same generic message
regardless of whether the account exists (prevents user enumeration) and only actually
emails a link if the username looks like an email (regex-checked via the same
`_EMAIL_RE` pattern `pii.py` uses) — phone-number usernames have no delivery channel
today (no SMS/WhatsApp integration). `reset-password` validates the token
(hash+expiry+not-used), updates `password_hash`, and **revokes every existing refresh
token for that account** — a password reset forces re-login everywhere, not just a
password change.

**`get_current_user` dependency** (`app/api/auth.py`): reads the `access_token` cookie,
decodes the JWT, loads the `User` row. Used by `GET /api/auth/me` only — **no other
route in the app currently requires authentication**; the auth layer gates the frontend
experience (`RequireAuth`) but does not (yet) protect the REST API's other 60+ endpoints
per-request. See §16.

**Frontend session lifecycle:** `authStore.initAuth()` on app mount tries `/me`, falls
back to one `/refresh` + retry `/me` — this is what makes a browser reload survive an
expired 15-minute access token without forcing a fresh login, as long as the 30-day
refresh token is still valid.

---

## 10. Database Design

Single Postgres database (`pgvector/pgvector:pg16`), 28 application tables + Alembic's
own `alembic_version`. Schema lives entirely in `backend/app/core/models.py`; every
change goes through `alembic revision --autogenerate -m "..."` then `alembic upgrade head`.

| Domain | Tables | Notes |
|---|---|---|
| **Accounts & auth** | `users`, `refresh_tokens`, `password_reset_tokens` | See §9 |
| **Core / cross-skill** | `conversations`, `messages`, `memory_facts`, `user_profile`, `notification_preferences`, `notifications` | `user_profile`/`notification_preferences` are single-row tables (hardcoded `id=1` pattern) — pre-date `users` and were never migrated to be per-account |
| **Tasks** | `tasks` | `priority` enum (urgent/normal/light), `recurrence_rule` free text parsed by `app/common/recurrence.py` |
| **Planner** | `planner_items` | `mode` enum (daily/weekly/monthly) — each mode is functionally a separate list |
| **Learning** | `courses`, `certifications`, `revision_items` | Courses carry AI-set `roadmap_position`/`roadmap_rationale`; certifications carry Cloudinary file metadata for cleanup-on-delete |
| **Career** | `resumes`, `job_applications` | Resumes track `storage_provider` (Cloudinary or R2) + a `storage_key` so deleting the DB row also deletes the underlying file |
| **Habits** | `habits`, `habit_logs` | `habit_logs` has a unique constraint on `(habit_id, log_date)` — one log per day |
| **Finance** | `expenses`, `budgets`, `subscriptions`, `savings_goals`, `savings_entries` | `savings_goals` (progress toward a target) is distinct from `savings_entries` (a flat ledger of completed savings) |
| **News** | `news_items` | 3-day retention unless `starred`; `read`/`starred` are UI-only flags |
| **Knowledge Base** | `notes`, `bookmarks`, `documents`, `document_chunks` | `document_chunks` holds the pgvector embeddings backing RAG search |

**Vector search:** `memory_facts.embedding` and `document_chunks.embedding` are both
`Vector(768)` (`pgvector.sqlalchemy.Vector`), populated by Gemini's
`gemini-embedding-001` model. Queried via SQLAlchemy's `.cosine_distance()` operator.

**Cross-table pattern to know:** almost every "uploaded file" table (`certifications`,
`resumes`, `documents`) stores `storage_provider`/`storage_key`/`storage_resource_type`
alongside the file's public URL — this is what lets a DELETE endpoint also call
Cloudinary's/R2's own delete API instead of leaving orphaned files in object storage
forever. Follow this pattern for any future file-upload feature.

---

## 11. AI / LLM Architecture

**Agent framework:** Google ADK (`google.adk.agents.Agent`, `google.adk.runners.Runner`).
One `root_agent` (`app/core/agent.py`) is the template; `get_agent_for_skill(skill_id)`
returns a cached, deep-copied clone per skill with that skill's own `tools.py` merged in
and its model swapped to the tier-appropriate one.

**Model routing** (`app/core/model_router.py`, `model_tiers.py`): three tiers by
workload shape —

| Tier | Used by | Chain (in order) |
|---|---|---|
| A (fast/simple) | tasks, habits, *default* | `groq/llama-3.1-8b-instant` → `gemini/gemini-2.0-flash` → HF `novita/meta-llama/Llama-3.1-8B-Instruct` |
| B (tool-heavy) | planner, finance, career | `groq/llama-3.3-70b-versatile` → HF `featherless-ai/NousResearch/Hermes-3-Llama-3.1-8B` → `gemini/gemini-2.5-flash` |
| C (long-context) | news, learning, knowledge_base, analytics | `gemini/gemini-2.5-flash` → HF `novita/Qwen/Qwen2.5-72B-Instruct` → `groq/llama-3.3-70b-versatile` |

`FallbackLiteLLMClient` (a `LiteLLMClient` subclass) tries each `ModelSpec` in a tier's
chain in order, catching `litellm.{RateLimitError, APIConnectionError, Timeout,
ServiceUnavailableError, AuthenticationError, NotFoundError}` and falling through to the
next step — deliberately including auth/not-found errors so a tier degrades gracefully
even when a provider simply isn't configured, not just when it's rate-limited.

**Known Groq quirk handled explicitly:** reasoning-capable Groq models
(`groq/qwen/qwen3-32b`, GPT-OSS variants, DeepSeek-R1-distill) return a separate
`reasoning_content` field that ADK/litellm currently round-trips into message history —
Groq's own API then rejects that on the next turn. Fixed by passing
`reasoning_format="hidden"` to exactly those model strings (`_GROQ_REASONING_MODELS` set
in `model_router.py`).

**Which provider actually served a turn** is tracked via a `contextvars.ContextVar`
(`request_key_var`) set to the chat session_id *before* `runner.run_async()` (so it
propagates into whatever child task ADK spawns), read back by
`FallbackLiteLLMClient._record_served_by()` into a plain dict keyed by that same
session_id, popped by the caller (`chat.py`) right after the run completes and attached
to the LangSmith trace as `served_by: {tier, provider, model}`.

**Progressive Disclosure of skill instructions:** `app/skills/loader.py` reads only
YAML frontmatter (`name`/`description`) from every `SKILL.md` at startup for the
system-prompt menu; the instructions body is loaded on demand via the
`get_skill_instructions(skill_id)` tool once the model decides a skill is relevant.

**Memory:** `remember(fact, source_skill)` and `recall(query, top_k=5)` — universal
tools on every skill's agent. `remember` redacts PII (via `app/common/pii.py`) *before*
embedding+storage, not just before display, so a stray email/phone number the user
mentions never lands in `memory_facts.content` at all.

**Guardrails layer** (all under `app/common/` unless noted):
- `pii.py` — regex + Luhn-validated credit-card detection; email, phone, SSN, Aadhaar,
  PAN, street address patterns; deliberately no external API call (would leak the very
  data being checked).
- `injection_guard.py` — two functions: `neutralize_injection_attempts()` (redact-only,
  for text that will be *persisted and re-read later*, e.g. News titles) vs.
  `sanitize_external_content()` (redact + wrap in an explicit
  "untrusted data" delimiter block, for text entering a *live* prompt right now, e.g.
  News's batch-summarize prompt, Knowledge Base's RAG context).
- `app/core/agent_hooks.py` — see §6's tool-call section; this is where the allow-list/
  HITL/injection/PII layers actually get enforced on every tool call.
- `docs/guardrails/THREAT_MODEL.md` — STRIDE pass over `buddy-mcp` and the notification
  pipeline specifically (the two highest-blast-radius components).

**Evaluation** (`evals/`): one YAML file per skill (`evals/cases/<skill>_cases.yaml`),
8 cases each covering happy-path/ambiguous-input/HITL-triggering/adversarial categories.
`evals/run_evals.py` replays each case against the real agent via
`get_runner_for_skill()`, checks the actual tool-call sequence against
`expected_tool_calls` (subsequence match — extra calls like an incidental `remember` are
tolerated) and a keyword check against `expected_outcome`, wrapped in a LangSmith trace
per case. **Known limitation:** a full clean 72-case run across all 9 skills has not yet
been completed end-to-end due to free-tier model quota exhaustion during testing — the
harness itself is verified correct on real subset runs.

---

## 12. External Integrations

| Service | Used for | Config vars | Failure mode |
|---|---|---|---|
| Google Gemini | Chat (all 3 tiers' fallback chains), embeddings (always Gemini regardless of chat tier) | `GEMINI_API_KEY` | Falls through to next tier step; embeddings have no fallback (memory read/write fails if Gemini is down) |
| Groq | Chat (first step in every tier) | `GROQ_API_KEY` | Falls through |
| Hugging Face Inference Providers | Chat (fallback step) | `HF_TOKEN` | Falls through |
| LangSmith | Tracing every chat turn + every tool call | `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` | Best-effort — wrapped in try/except, tracing failures never break a request |
| Gmail SMTP | Outbound notification emails | `EMAIL_ADDRESS`, `EMAIL_APP_PASSWORD` (Gmail App Password, not the real password) | `send_email_guarded` catches and logs; in-app `Notification` row always exists regardless |
| Cloudinary | Avatars, cert images, DOCX resumes | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Upload endpoints return 503 if unconfigured |
| Cloudflare R2 | PDF resumes specifically (inline-preview URLs Cloudinary's attachment behavior doesn't give) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` | Same pattern |
| arXiv, GitHub Trending, Hacker News | News skill's daily digest sources | none (public endpoints) | Per-source failure just yields fewer items that day |

All external content ingestion (News, Knowledge Base document uploads, Career's JD
paste) is treated as **untrusted** — see §11's injection_guard notes.

---

## 13. Build and Deployment Instructions

**There is no containerized deployment today** — no Dockerfile for the backend or
frontend, only `docker-compose.yml` for local Postgres. This is a local-dev-only setup
currently; see §15/§16 for what production deployment would need.

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install --upgrade pip && pip install -r requirements.txt
cp ../.env.example ../.env   # fill in secrets
docker compose up -d          # from repo root — starts Postgres
alembic upgrade head
uvicorn app.main:app --reload
```
Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`. Interactive docs
at `/docs`.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL defaults to http://localhost:8000
npm run dev              # http://localhost:5173
npm run build             # tsc -b && vite build → dist/
```

### New migration after changing `models.py`
```bash
cd backend
alembic revision --autogenerate -m "description of change"
alembic upgrade head
```
Always inspect the autogenerated file before applying — Alembic sometimes over/under-
detects (e.g. it doesn't autodetect Postgres `SERIAL` sequence ownership changes; it
prints an INFO log about "assuming SERIAL and omitting" which is expected, not an error).

---

## 14. Coding Standards Followed

**Python (backend)**
- **Black** (line length default) + **Ruff** (lint with `--fix`, plus a separate
  `--select I --no-fix` import-sort *check* step) — both enforced by pre-commit, not
  just convention.
- Async everywhere in the request path — `AsyncSession`, `async def` route handlers,
  `asyncio.to_thread()` for any genuinely blocking call (e.g. `smtplib`, Cloudinary's
  sync SDK).
- Comments explain **why**, not what — hidden constraints, upstream library quirks
  (e.g. the Groq `reasoning_format` note in `model_router.py`), non-obvious invariants.
  Never restate what a well-named function already says.
- Every SQLAlchemy query is parameterized (`select()`/`.where()`) — a custom Semgrep
  rule (`sql-raw-string-formatting`) specifically flags raw f-string/`.format()`/`%`
  interpolation into `execute()`/`text()`.
- No bare `eval()`/`exec()`/`pickle.loads()` on anything that could originate from user
  input or an external API — also Semgrep-enforced (`dangerous-eval-exec-pickle`).
- Settings only ever loaded via `get_settings()` (`pydantic-settings`, `@lru_cache`) —
  never `os.environ[...]` scattered through business logic (the model router's own
  `os.environ.setdefault(...)` calls are the one deliberate exception, needed to
  propagate keys into litellm/ADK's expected env-var names).

**TypeScript/React (frontend)**
- Function components, hooks — no class components anywhere.
- Every skill's data layer is a plain `api.ts` (typed fetch wrappers) — no axios, no
  shared HTTP client abstraction; consistency comes from convention, not a shared class.
- Shared style tokens (`lib/styles.ts`) and CSS custom properties (`index.css`) — never
  a hardcoded hex color or one-off Tailwind color utility in a component.
- `cn()` (clsx + tailwind-merge) for all conditional/merged className logic.
- Mutations always follow the try/success-toast/catch-error-toast-and-rethrow pattern
  (§7) — consistent user feedback, and callers' existing control flow (e.g. "keep a
  modal open on failure") is never silently broken.

**Both**
- No unrequested abstractions/refactors bundled into unrelated changes — a bug fix
  doesn't get a surrounding cleanup unless asked for.
- Every nontrivial change in this project's history was verified against the *real*
  running stack (real Postgres, real LLM providers, real curl/browser checks) wherever
  feasible, with test data cleaned up afterward — not just "should work" reasoning.

---

## 15. Common Commands

```bash
# Backend dev server (from backend/, venv active)
uvicorn app.main:app --reload

# Frontend dev server (from frontend/)
npm run dev

# New DB migration (from backend/)
alembic revision --autogenerate -m "..."
alembic upgrade head

# Run backend tests (from backend/)
pytest tests/ -q

# Run the eval harness (from evals/, or repo root with correct pythonpath)
python evals/run_evals.py --skill tasks --limit 5
python evals/run_evals.py             # all skills, all cases

# Security scan (from repo root — sets up an isolated venv on first run)
make security-scan

# Pre-commit (one-time setup, then automatic on every commit)
.tools/semgrep-venv/bin/pip install pre-commit detect-secrets
.tools/semgrep-venv/bin/pre-commit install
.tools/semgrep-venv/bin/pre-commit run --all-files    # run on everything manually

# Regenerate the secrets baseline after adding a new migration/file
.tools/semgrep-venv/bin/detect-secrets scan > .secrets.baseline

# Postgres (from repo root)
docker compose up -d
docker compose down
docker compose exec db pg_isready -U buddy

# Frontend production build + typecheck
cd frontend && npx tsc -b --noEmit    # typecheck only
npm run build                          # full production build
```

**Never install Semgrep/pre-commit/detect-secrets/ruff/black into `backend/venv`** —
use `.tools/semgrep-venv` (already the convention; see `.gitignore`'s comment). Doing
this once mid-project downgraded shared dependencies (`mcp`, `opentelemetry`,
`jsonschema`) incompatibly with `google-adk`/`litellm` and took the running backend down
until reinstalled from `requirements.txt`.

---

## 16. Known Limitations

- **Single-user data model behind real accounts.** `users` enables real signup/login,
  but tasks/habits/finance/planner/etc. are not scoped per-account — every account that
  ever logs into a given deployment shares the same task list, expense ledger, etc. This
  is a deliberate scope boundary (§5), not a bug, but it means this is not yet a
  multi-tenant product.
- **Most REST endpoints are not auth-protected.** Only `GET /api/auth/me` requires a
  valid session; the other 60+ endpoints across all 9 skills have no per-request auth
  check. The auth layer gates the *frontend* (via `RequireAuth`), not the API itself.
- **No containerized/production deployment path yet** — no Dockerfile, no reverse
  proxy config, no HTTPS setup, cookies still `secure=False`.
- **Mid-stream provider failure is unrecoverable** (§5/§11) — only pre-stream failures
  trigger the model fallback chain.
- **PII scanner is regex/rules-based**, not ML-based — catches common structured PII
  formats, not every conceivable one, by design (avoids sending text to an external
  service for detection).
- **No SMS/WhatsApp integration** — password-reset and notifications only support
  email; a phone-number username has no delivery channel for reset links today.
- **Career's `jd_text` (skill_gap_analysis) and any user-pasted text in Finance chat**
  are not run through `sanitize_external_content()` the way News/Knowledge Base's
  ingested content is — a known, documented gap (see `docs/guardrails/career.SKILL.md`
  and `THREAT_MODEL.md`).
- **No MCP tool for logging against a savings goal** — `SavingsEntry` has full REST
  CRUD but no corresponding Finance MCP tool, so it's not chat-reachable.
- **Full 72-case eval suite has not been run clean end-to-end** — verified correct on
  real subset runs; a complete run was blocked by free-tier model quota exhaustion
  during testing, not a harness defect.
- **Large frontend JS bundle** (~1.8MB pre-gzip) — Vite warns about chunks over 500KB;
  no code-splitting/`manualChunks` has been set up yet.
- **A successfully *sent* email isn't logged as its own distinct event** — only
  withheld sends (PII detected) log a warning; the in-app `Notification` row is the
  audit trail for the underlying event either way.

---

## 17. Future Roadmap

From the capstone writeup's own "Phase 13 Left and Future Enhancements," plus gaps
surfaced above:

- Final deployment configuration (containerization, HTTPS, `secure=True` cookies) and a
  recorded demo walkthrough.
- A full clean Evaluation-Driven Development run across all nine skills' golden case
  sets once model-provider quota allows.
- Extend `sanitize_external_content()` to Career's `jd_text` and any future skill
  accepting free-form external text.
- Add an MCP tool for logging directly against a savings goal from chat.
- Revisit Agent-to-Agent orchestration and an agent-generated interface (A2UI) as
  genuine future directions — only if the product actually grows a need for
  cross-domain negotiation or an adaptive UI, not as complexity for its own sake.
- Consider whether/how to move to real multi-tenancy (per-account data scoping) if the
  product ever needs to serve more than one real user per deployment.
- Frontend bundle code-splitting (dynamic `import()` per skill page) to address the
  chunk-size warning.

---

## 18. Important Notes for Future Contributors

- **Read `docs/guardrails/ROOT_AGENT.md` and the per-skill `docs/guardrails/*.SKILL.md`
  files before adding a new tool or skill.** They document exact allowed-tools lists,
  HITL requirements, and data boundaries — `app/core/agent_hooks.py`'s `ALLOWED_TOOLS`
  dict must be kept in sync with both a skill's real `tools.py` and its guardrail doc.
- **Adding a new skill requires zero changes to `app/core/agent.py`.** Just: (1) create
  `app/skills/<id>/SKILL.md` with `name`/`description` frontmatter + instructions body,
  (2) optionally add `app/skills/<id>/tools.py` with a `TOOLS` list, (3) add one line to
  `SKILL_TIER` in `model_tiers.py`, (4) add the skill to `agent_hooks.py`'s
  `ALLOWED_TOOLS` if it has tools, (5) add it to `frontend/src/config/skills.ts` for nav.
- **Never install security/lint tooling into `backend/venv`** — see §15.
- **`git commit` will fail on a fresh Alembic migration** until you run
  `.tools/semgrep-venv/bin/detect-secrets scan > .secrets.baseline` afterward — the
  auto-generated revision hash reads as a "Hex High Entropy String" false positive
  every time. This is expected, not a real secret; just regenerate the baseline and
  re-stage it.
- **`PROFILE_ID = 1` / `PREFS_ID = 1` hardcoded singleton patterns** in `profile.py` and
  `notifications.py` are intentional given the single-user data model — don't "fix"
  them into a real per-user lookup without also addressing the broader multi-tenancy
  gap consistently (§16).
- **The two SQLite/Postgres session stores are not interchangeable** — `backend/data/
  sessions.db` (ADK's own) vs. `conversations`/`messages` (Postgres, user-facing
  history). Don't try to read chat history out of the SQLite file; use the Postgres
  tables via `app/api/conversations.py`.
- **Model strings and Hugging Face Inference Provider availability drift over time** —
  `model_tiers.py`'s comments explicitly call out re-verifying against
  `https://docs.litellm.ai/docs/providers` and `https://huggingface.co/models` before
  changing a chain, since HF's specific inference-provider partners for a given model
  can change.
- **This document should be kept current.** When you add a skill, table, endpoint, or
  external integration, update the relevant section here in the same PR — that's the
  whole point of it existing.
