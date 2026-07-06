"""Finance skill tools — unlike every other skill, these are NOT plain
Python functions calling the DB directly. Per the Finance skill's design,
the agent talks to a genuinely separate MCP server (mcp-servers/buddy-mcp)
over stdio via ADK's McpToolset, which discovers that server's tools
(add_expense, get_expense_summary, check_budget_status, add_subscription,
get_savings_progress, get_monthly_insights) and exposes them to the agent
automatically — nothing needs to be listed here by name.
"""

import sys
from pathlib import Path

from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from mcp import StdioServerParameters

BACKEND_DIR = Path(__file__).resolve().parents[3]
MCP_SERVER_PATH = BACKEND_DIR.parent / "mcp-servers" / "buddy-mcp" / "server.py"

TOOLS = [
    McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command=sys.executable,
                args=[str(MCP_SERVER_PATH)],
                cwd=str(BACKEND_DIR),
            ),
            timeout=10.0,
        )
    )
]
