import dataclasses
from pathlib import Path

import yaml

SKILLS_DIR = Path(__file__).parent


@dataclasses.dataclass(frozen=True)
class SkillMeta:
    id: str
    name: str
    description: str
    path: Path

    @property
    def scripts_dir(self) -> Path:
        return self.path / "scripts"

    @property
    def resources_dir(self) -> Path:
        return self.path / "resources"

    @property
    def artifacts_dir(self) -> Path:
        return self.path / "artifacts"


def _read_frontmatter(skill_md: Path) -> tuple[dict, str]:
    text = skill_md.read_text()
    _, frontmatter, body = text.split("---", 2)
    return yaml.safe_load(frontmatter) or {}, body.strip()


def discover_skills() -> dict[str, SkillMeta]:
    """Scan app/skills/*/SKILL.md and load only their name/description metadata.

    Instruction bodies are deliberately not read here — they're loaded lazily
    by get_skill_instructions() so the agent only pulls a skill's detailed
    instructions into context once it actually needs them (progressive
    disclosure), rather than upfront for every skill.
    """
    skills: dict[str, SkillMeta] = {}
    for entry in sorted(SKILLS_DIR.iterdir()):
        skill_md = entry / "SKILL.md"
        if not entry.is_dir() or not skill_md.exists():
            continue
        metadata, _ = _read_frontmatter(skill_md)
        skills[entry.name] = SkillMeta(
            id=entry.name,
            name=metadata.get("name", entry.name),
            description=metadata.get("description", ""),
            path=entry,
        )
    return skills


def get_skill_instructions(skill_id: str) -> str:
    """Load a skill's full instructions on demand.

    Call this once you've identified, from a skill's name/description, that
    its detailed instructions are relevant to the user's current request.
    """
    skill_md = SKILLS_DIR / skill_id / "SKILL.md"
    if not skill_md.exists():
        available = ", ".join(discover_skills())
        return f"Unknown skill_id '{skill_id}'. Available skills: {available}"
    _, body = _read_frontmatter(skill_md)
    return body
