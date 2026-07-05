# Buddy

## Project structure

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
  docker-compose.yml   # local Postgres (pgvector) for development
  .env.example
```

## Backend setup

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

## Deactivating the virtual environment

```bash
deactivate
```

## Frontend setup

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
