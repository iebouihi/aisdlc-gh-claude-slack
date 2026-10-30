"""The living spec store: specs/<module>/<capability>.md files with YAML frontmatter.

Loads specs, validates proposed updates, renders the compact indexes Claude selects from,
and generates the README indexes committed with every spec change.
"""
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from .catalog import read_markdown

FILE_BLOCK = re.compile(r"=== FILE: (\S+) ===\n(.*?)\n=== END FILE ===", re.S)
DECISION_ROW = re.compile(r"^\|\s*D\d+\s*\|", re.M)  # live decisions only (superseded ones are ~~struck~~)


@dataclass
class Spec:
    path: str        # repo-relative, e.g. specs/habits/habit-management.md
    meta: dict
    content: str     # the whole file

    @property
    def id(self):
        return self.meta.get("id", "")

    @property
    def module(self):
        return self.meta.get("module", "")

    def entities(self):
        return ", ".join(self.meta.get("entities") or [])

    def decisions(self):
        return len(DECISION_ROW.findall(self.content))


def _is_capability(path, spec_dir):
    return path.name != "README.md" and path.parent.parent == spec_dir


def load(root, spec_dir="specs"):
    base = Path(root) / spec_dir
    specs = []
    for path in sorted(base.glob("*/*.md")) if base.exists() else []:
        if _is_capability(path, base):
            meta, _ = read_markdown(path)
            specs.append(Spec(path.relative_to(root).as_posix(), meta, path.read_text(encoding="utf-8")))
    return specs


def parse_updates(text, file_pattern, required_fields):
    """Parse '=== FILE: path === ... === END FILE ===' blocks and validate each spec."""
    updates, pattern = [], re.compile(file_pattern)
    for path, content in FILE_BLOCK.findall(text or ""):
        path, content = path.strip(), content.strip() + "\n"
        if not pattern.match(path) or ".." in path:
            raise ValueError(f"spec path not allowed: {path}")
        if not content.startswith("---"):
            raise ValueError(f"{path}: frontmatter missing")
        meta = yaml.safe_load(content.split("---", 2)[1]) or {}
        missing = [f for f in required_fields if f not in meta]
        if missing:
            raise ValueError(f"{path}: frontmatter lacks {', '.join(missing)}")
        module, name = path.split("/")[1], path.split("/")[2][:-3]
        if meta["module"] != module or meta["id"] != f"{module}/{name}":
            raise ValueError(f"{path}: id/module must be {module}/{name}")
        updates.append(Spec(path, meta, content))
    return updates


def merge(specs, updates):
    by_path = {s.path: s for s in specs}
    by_path.update({u.path: u for u in updates})
    return sorted(by_path.values(), key=lambda s: s.path)


def modules(specs):
    grouped = {}
    for s in specs:
        grouped.setdefault(s.module, []).append(s)
    return grouped


def _entities(specs):
    return ", ".join(sorted({e for s in specs for e in (s.meta.get("entities") or [])}))


def module_index(specs, texts):
    return "\n".join(texts["index_module"].format(module=m, count=len(ss), entities=_entities(ss),
                                                  titles="; ".join(s.meta.get("title", "") for s in ss))
                     for m, ss in modules(specs).items())


def spec_index(specs, texts):
    return "\n".join(texts["index_spec"].format(id=s.id, title=s.meta.get("title", ""), entities=s.entities(),
                                                summary=s.meta.get("summary", "")) for s in specs)


def generated_files(specs, texts, product, spec_dir="specs"):
    """README indexes for specs/ and each module, derived only from the specs' frontmatter."""
    grouped = modules(specs)
    root = [texts["root_title"], "", texts["root_intro"].format(product=product), ""]
    root += [texts["module_line"].format(module=m, count=len(ss), entities=_entities(ss))
             for m, ss in grouped.items()] or [texts["empty"]]
    files = {f"{spec_dir}/README.md": "\n".join(root) + "\n"}
    for m, ss in grouped.items():
        lines = [texts["module_title"].format(module=m), "", texts["module_intro"], ""]
        lines += [texts["capability_line"].format(
            title=s.meta.get("title", ""), file=Path(s.path).name, id=s.id, summary=s.meta.get("summary", ""),
            entities=s.entities(), decisions=s.decisions(),
            issues=", ".join(f"#{i}" for i in s.meta.get("issues") or [])) for s in ss]
        files[f"{spec_dir}/{m}/README.md"] = "\n".join(lines) + "\n"
    return files


def to_blocks(updates):
    return "\n".join(f"=== FILE: {u.path} ===\n{u.content.rstrip()}\n=== END FILE ===" for u in updates)


def dump_frontmatter(meta):
    return yaml.safe_dump(meta, sort_keys=False, allow_unicode=True).strip()
