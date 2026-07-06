# buddy-mcp

A standalone MCP (Model Context Protocol) server exposing Buddy's finance
tools: `add_expense`, `get_expense_summary`, `check_budget_status`,
`add_subscription`, `get_savings_progress`, `get_monthly_insights`.

It talks directly to the same Postgres database as the main FastAPI
backend — `server.py` adds `backend/` to `sys.path` and imports
`app.core.db` / `app.core.models` / `app.common.finance` from it directly,
so there's exactly one implementation of "how a budget status is computed",
shared between this server and the backend's own REST API
(`backend/app/api/finance.py`).

## Transport

Stdio. ADK's `McpToolset` (and the `mcp` CLI) both speak MCP-over-stdio to
a child process, which is the simplest setup for a same-machine, single-user
app like this one — no separate long-running server/port to manage. See
`backend/app/skills/finance/tools.py` for how the Finance skill's agent
spawns this as a subprocess automatically; nothing needs to be started by
hand for the app to work.

## Running standalone

It reads DB/API-key config from the same `.env` the backend uses (one level
above `backend/`), via `app.core.config.Settings`, which resolves its
`env_file="../.env"` relative to the **current working directory** — so run
it with `backend/` as your cwd:

```bash
cd backend
../mcp-servers/buddy-mcp/venv/bin/python ../mcp-servers/buddy-mcp/server.py   # if using a separate venv
# or, simplest — reuse the backend's own venv (already has sqlalchemy/asyncpg/etc.):
./venv/bin/python ../mcp-servers/buddy-mcp/server.py
```

It will then sit waiting for MCP JSON-RPC messages on stdin/stdout — that's
expected, it's meant to be driven by an MCP client, not used interactively.
To poke it manually during development, use the MCP Inspector:

```bash
cd backend
npx @modelcontextprotocol/inspector ./venv/bin/python ../mcp-servers/buddy-mcp/server.py
```

## Installing dependencies

If running from the backend's own venv (recommended, see above), only the
`mcp` package needs adding there — everything else (`sqlalchemy`,
`asyncpg`, `google-genai`, etc.) is already installed for the backend:

```bash
cd backend && ./venv/bin/pip install mcp
```

To run this server from its own independent venv instead:

```bash
cd mcp-servers/buddy-mcp
python -m venv venv
./venv/bin/pip install -r requirements.txt
```

## Configuration

All configuration is via the shared `.env` at the repo root (`buddy/.env`,
one level above `backend/`) — see `.env.example` there. The tools relevant
to this server:

- `database_url` — must point at the same Postgres instance/database as
  the backend.
- `gemini_api_key` — used by `get_monthly_insights` to generate its
  natural-language insight sentence.

No separate configuration file is needed for this server; it's not a
distinct deployable, just an alternate process entrypoint into the same
backend codebase.
