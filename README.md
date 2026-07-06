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
and shadcn/ui (neutral theme). Requires Node.js 18, 20, or 22+.

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

The app is served at `http://localhost:5173`. With the backend running, the status bar at the
top of the page should read "status: ok". Placeholder routes are set up at `/`, `/profile`, and
`/about`.

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
