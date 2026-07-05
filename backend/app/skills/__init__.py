from google.adk.agents import Agent

from app.skills.loader import discover_skills, get_skill_instructions

__all__ = ["load_skills", "discover_skills", "get_skill_instructions"]


def load_skills(agent: Agent) -> None:
    """Wire the universal, cross-skill parts of skill support onto an agent.

    Each skill is a folder (app/skills/<id>/) with a SKILL.md file. Its
    `name`/`description` frontmatter is surfaced up front in the agent's
    system prompt so it knows what's available; the rest of SKILL.md (the
    detailed instructions) is only loaded when the agent calls
    get_skill_instructions(skill_id) — progressive disclosure, so an
    ever-growing library of skills doesn't bloat every request's context.

    This does NOT wire a skill's own tools.py (TOOLS/SUB_AGENTS) onto the
    given agent — that would make e.g. "tasks" tools available while
    chatting under "general" too, since agents built here are typically
    shared. Per-skill tool scoping instead happens in
    app.core.agent.get_agent_for_skill(), which builds a dedicated clone of
    root_agent per skill that ships its own tools.py.
    """
    skills = discover_skills()

    if get_skill_instructions not in agent.tools:
        agent.tools.append(get_skill_instructions)

    menu = "\n".join(f"- {meta.id}: {meta.description}" for meta in skills.values())
    agent.instruction += (
        "\n\nAvailable skills:\n"
        f"{menu}\n\n"
        "When one of these skills is relevant to the user's request, call "
        "get_skill_instructions(skill_id) to load its detailed instructions "
        "before proceeding."
    )
