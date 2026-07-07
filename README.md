<div align="center">

![Buddy — Your Agentic AI Personal Assistant](assets/Thumbnail.png)

# 🤖 Buddy

### Your Agentic AI Personal Assistant

**One root agent. Nine life skills. Zero wasted context.**

Buddy is a single conversational agent that plans your day, tracks your tasks, curates your tech news, manages your job search, sequences your learning, watches your budget, keeps your habit streaks, remembers your notes, and reports on all of it — so you talk to one assistant instead of juggling nine apps.

</div>

---

## ✨ What is Buddy?

Buddy is built on **Google's Agent Development Kit (ADK)** as one root agent that loads a different "skill" — its own tools, prompts, and data boundaries — depending on what you're doing, instead of running nine separate bots. It standardizes tool access through **MCP**, keeps a two-tier memory (short-term session state + long-term semantic recall over `pgvector`), and treats safety as a first-class feature: every consequential action needs your explicit confirmation before it happens.

## 🧩 The Nine Skills

<div align="center">

![Buddy's nine skills](assets/All_skills.png)

</div>

| # | Skill | What it does |
|---|-------|---------------|
| 📅 | **Smart Planner** | Turns your stated tasks into an actual time-blocked daily schedule |
| ✅ | **Task Manager** | Priority-aware tasks with timed reminders, so nothing slips through |
| 📰 | **Personalized News** | Daily digest aggregated from arXiv, GitHub, and Hacker News |
| 💼 | **Career Hub** | Resume versions + job application tracker in one place |
| 🎓 | **Learning Hub** | Course roadmaps, deadlines, and spaced revision nudges |
| 💰 | **Finance Tracker** | Conversational expense logging with real-time budget checks |
| 🔥 | **Habit Tracker** | Streaks and milestone celebrations that keep motivation alive |
| 📚 | **Knowledge Base** | Semantic search over your own notes and documents (RAG) |
| 📊 | **Analytics Dashboard** | Cross-skill reporting on what actually happened this week |

## 🏗️ System Architecture

<div align="center">

![Buddy's system architecture](assets/System_architecture.png)

</div>

Frontend (React) → Backend (FastAPI) → ADK Orchestrator (Agentic Core) → MCP / Tools → External LLMs (Gemini, Groq, Hugging Face) → PostgreSQL + pgvector for memory and storage.

---

## 📁 Project Structure

```
buddy/
  frontend/            # frontend app
  backend/             # FastAPI backend
    app/
      core/            # core config, settings, db, etc.
      skills/          # agent skills
      common/          # shared utilities
    requirements.txt
  mcp-servers/
    buddy-mcp/         # MCP server(s)
  docs/
    guardrails/        # per-skill security specs + threat model
  evals/               # golden-case evaluation harness
  assets/              # README/writeup images
  docker-compose.yml   # local Postgres (pgvector) for development
  .env.example
```

## 🗄️ Database Schema

All 28 tables live in one Postgres database (`backend/app/core/models.py`, migrated via
Alembic — `backend/alembic/versions/`), grouped here by what they back:

| Domain | Tables |
|---|---|
| **Accounts & auth** | `users`, `refresh_tokens`, `password_reset_tokens` |
| **Core / cross-skill** | `conversations`, `messages`, `memory_facts`, `user_profile`, `notification_preferences`, `notifications` |
| **Tasks** | `tasks` |
| **Planner** | `planner_items` |
| **Learning Hub** | `courses`, `certifications`, `revision_items` |
| **Career Hub** | `resumes`, `job_applications` |
| **Habit Tracker** | `habits`, `habit_logs` |
| **Finance Tracker** | `expenses`, `budgets`, `subscriptions`, `savings_goals`, `savings_entries` |
| **Personalized News** | `news_items` |
| **Knowledge Base** | `notes`, `bookmarks`, `documents`, `document_chunks` |

Notes:
- `users` backs real accounts (signup/login) — everything else stays the single-user
  schema it always was (no per-account `user_id` scoping on tasks/habits/finance/etc.).
  See the "🔑 Authentication & Accounts" section below.
- `memory_facts` is Buddy's long-term semantic memory (pgvector embeddings, shared
  across every skill via the `remember`/`recall` tools), separate from `conversations`/
  `messages`, which are just per-session chat history.
- `document_chunks` holds pgvector embeddings for the Knowledge Base's RAG search over
  `documents`.

## ⚙️ Backend Setup

The backend is a Python/FastAPI project located in `backend/`.

### 1. Create and activate a virtual environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure environment variables

The backend reads a single `.env` file from the project root (shared with `docker-compose.yml`).
From the project root:

```bash
cp .env.example .env
```

Then fill in any secrets (`GEMINI_API_KEY`, `LANGSMITH_API_KEY`, etc.). Settings are loaded via
`backend/app/core/config.py` (`get_settings()`), which reads and caches these environment
variables using `pydantic-settings`.

### 4. Run the development server

From the `backend/` directory, with the virtual environment activated:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Check that it's running:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

Interactive API docs are available at `http://localhost:8000/docs`.

CORS is enabled for `http://localhost:5173` (the default Vite frontend dev server port).

### 5. Start Postgres with pgvector

A `docker-compose.yml` is provided at the project root for local development. It reads
`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from the root `.env` file, and persists
data in a named volume (`buddy_db_data`) so it survives container restarts.

Make sure you've created `.env` from `.env.example` (see step 3), then from the project root:

```bash
docker compose up -d
```

Verify Postgres is up and reachable:

```bash
docker compose ps
# db should show state "Up"/"healthy"

docker compose exec db pg_isready -U buddy
# should print: /var/run/postgresql:5432 - accepting connections

psql "postgresql://buddy:buddy@localhost:5432/buddy" -c "select 1;"
# (requires psql installed locally) should print a row with "1"
```

To stop the database:

```bash
docker compose down
```

### 6. Run database migrations

Schema is managed with Alembic (`backend/alembic/`). With Postgres running and the venv
activated, from the `backend/` directory:

```bash
alembic upgrade head
```

This creates the `vector` extension and the `conversations`, `messages`, and `memory_facts`
tables. To create a new migration after changing models in `app/core/models.py`:

```bash
alembic revision --autogenerate -m "description of change"
```

## 🔌 Deactivating the Virtual Environment

```bash
deactivate
```

## 🖥️ Frontend Setup

The frontend is a React + TypeScript app (Vite) located in `frontend/`, styled with Tailwind CSS
and shadcn/ui (neutral theme), with `zustand` for state (auth session, theme) and
`react-hot-toast` for notifications. Requires Node.js 18, 20, or 22+.

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

`VITE_API_URL` should point at the backend (defaults to `http://localhost:8000`).

### 3. Run the dev server

```bash
npm run dev
```

The app is served at `http://localhost:5173`. With the backend running, sign up at
`/signup`, then log in at `/login` — every other route redirects there until you do.

## 🔑 Authentication & Accounts

Custom FastAPI auth — no third-party auth provider. Sign up with an email or mobile
number as your username, name, current occupation, current CTC (optional), gender, and
date of birth; log in with just username + password (eye icon to show/hide it).

**Libraries:**
- [`PyJWT`](https://pyjwt.readthedocs.io/) — short-lived (15 min) access tokens.
- [`argon2-cffi`](https://argon2-cffi.readthedocs.io/) — Argon2 password hashing (not bcrypt/sha256).
- Stdlib `secrets` + `hashlib` — opaque, SHA-256-hashed refresh and password-reset tokens (not JWTs, so they're individually revocable from the DB rather than just expiring).

**How it works:**
- **JWT access tokens + rotating refresh tokens**, both in **HttpOnly, SameSite=Lax
  cookies** — never touched by frontend JS, so there's nothing for an XSS payload to
  steal via `document.cookie`. Every `/api/auth/refresh` call revokes the old refresh
  token and issues a new one (rotation), rather than reusing the same one indefinitely.
- **Signup does not log you in.** `POST /api/auth/signup` only creates the account
  (`201`, no cookies set) — the frontend sends you to `/login` afterward, so signup and
  login stay two distinct, explicit steps.
- **Forgot / reset password**: `POST /api/auth/forgot-password` emails a one-hour,
  single-use reset link (only for email-shaped usernames — no SMS/WhatsApp integration
  exists to reach a mobile-number username); always returns the same generic response
  either way, so it can't be used to enumerate which accounts exist.
  `POST /api/auth/reset-password` consumes that token and revokes every existing
  refresh token for the account, forcing a fresh login everywhere.
- **Scope note:** `users` backs real accounts, but the rest of the app's data (tasks,
  habits, finance, etc.) is still the single-user schema it always was — see the
  "🗄️ Database Schema" section above.

**On top of the base auth system:**
- **Theme picker** (Settings page) — 8 colour themes (Light, Dark, Dracula, Synthwave,
  Forest, Corporate, Luxury, Cupcake), inspired by DaisyUI's popular theme names but
  implemented as plain CSS-variable overrides swapped via a `data-theme` attribute
  (not the `daisyui` Tailwind plugin itself, which would collide with this app's
  existing shadcn/ui component classes). Persisted to `localStorage` via `zustand`.
- **Toast notifications** (`react-hot-toast`, wrapped in `frontend/src/lib/toast.tsx`)
  — every create/update/delete/upload across all 9 skills shows a top-center toast for
  3 seconds, with a close (✕) button, and clicking anywhere outside a toast dismisses
  it too. One shared `showSuccess`/`showError` pair keeps every notification in the
  app looking and behaving the same way.
- **`zustand`** for client state — `authStore` (session/user) and `themeStore` (active
  theme), both small enough to not need Redux/Context-provider boilerplate.

## 🔐 Security Scanning

Static analysis rules live in `.semgrep.yml` (repo root) — a few
project-specific rules (SQL string-formatting, `eval`/`exec`/`pickle`
misuse, hardcoded-credential patterns) on top of Semgrep's own `p/python`,
`p/security-audit`, and `p/secrets` registry packs. See
`docs/guardrails/` for the broader security/guardrail design this
supports.

Run it:

```bash
make security-scan
```

The first run creates an isolated venv at `.tools/semgrep-venv` and
installs Semgrep into it automatically — **Semgrep is never installed
into `backend/venv`**. (It was, once, during setup — installing it there
downgraded shared dependencies `mcp`/`opentelemetry`/`jsonschema` to
versions incompatible with `google-adk`/`litellm` and took the running
backend down until those were reinstalled from `requirements.txt`. Keep
security/lint tooling in its own venv.)

## 🪝 Pre-commit Hooks

`.pre-commit-config.yaml` runs, on every commit: the Semgrep scan above
(scoped to just the changed `.py` files, for speed), a `detect-secrets`
scan, `black` + `ruff` (lint, auto-fixing) + a `ruff`-based import-sort
check, standard hygiene checks (no private keys, no merge-conflict
markers, etc.), and a hard block on committing any `.env`, `.env.<env>`,
`*.pem`, `*.key`, or SSH private-key-named file (`.env.example` is
deliberately exempted — it's the committed template).

One-time setup (uses the same isolated venv as Semgrep above — never
`backend/venv`):

```bash
.tools/semgrep-venv/bin/pip install pre-commit detect-secrets
.tools/semgrep-venv/bin/pre-commit install
```

`detect-secrets` needs a baseline of already-reviewed "findings" (mostly
false positives — this project's dev-only `buddy:buddy@localhost`
placeholder DB credentials, and Alembic's own auto-generated revision
hashes, both of which look like secrets to a pattern-matcher but aren't).
Generate/refresh it with:

```bash
.tools/semgrep-venv/bin/detect-secrets scan > .secrets.baseline
git add .secrets.baseline
```

Run against the whole repo at any time with:

```bash
.tools/semgrep-venv/bin/pre-commit run --all-files
```

Note: right after (re)generating `.secrets.baseline`, the `detect-secrets`
hook will report "the baseline file was updated" and fail once — this is
normal (it's syncing line-number metadata) and resolves itself once
`.secrets.baseline` is actually committed; it does not mean a real secret
was found.
