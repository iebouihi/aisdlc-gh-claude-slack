"""Reads Claude Code agent and skill files so the automation and developers share one source."""
import json
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .config import ROOT

AGENTS_DIR = ROOT / ".claude" / "agents"
SKILLS_DIR = ROOT / ".claude" / "skills"
SECTION_BREAK = "\n\n---\n\n"


def read_markdown(path):
    """Split a Markdown file with YAML frontmatter into (metadata, body)."""
    text = Path(path).read_text(encoding="utf-8")
    if text.startswith("---"):
        _, front, body = text.split("---", 2)
        return yaml.safe_load(front) or {}, body.strip()
    return {}, text.strip()


@dataclass
class Skill:
    name: str
    description: str
    body: str
    tool: dict | None  # from output.schema.json, when the skill defines a structured answer

    def render(self, arguments=""):
        return self.body.replace("$ARGUMENTS", str(arguments))


@dataclass
class Agent:
    name: str
    description: str
    body: str
    skills: list = field(default_factory=list)

    def system_prompt(self, arguments="", only=None):
        """Agent body plus its preloaded skills, as Claude Code assembles a subagent.

        `only` limits the skills to the ones a step needs (smaller, cacheable prompt per step).
        """
        skills = [s for s in self.skills if only is None or s.name in only]
        if only is not None:
            skills.sort(key=lambda s: list(only).index(s.name))
        return SECTION_BREAK.join([self.body] + [s.render(arguments) for s in skills])

    def skill(self, name):
        for s in self.skills:
            if s.name == name:
                return s
        raise KeyError(f"agent {self.name} does not preload skill {name}")


def load_skill(name, skills_dir=SKILLS_DIR):
    folder = Path(skills_dir) / name
    meta, body = read_markdown(folder / "SKILL.md")
    schema = folder / "output.schema.json"
    tool = json.loads(schema.read_text(encoding="utf-8")) if schema.exists() else None
    return Skill(meta.get("name", name), meta.get("description", ""), body, tool)


def load_agent(name, agents_dir=AGENTS_DIR, skills_dir=SKILLS_DIR):
    meta, body = read_markdown(Path(agents_dir) / f"{name}.md")
    skills = [load_skill(s, skills_dir) for s in meta.get("skills", [])]
    return Agent(meta.get("name", name), meta.get("description", ""), body, skills)
