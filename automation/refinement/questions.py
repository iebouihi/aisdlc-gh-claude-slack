"""Parses the questions returned by the refine-kickoff skill ('<group> :: <question> :: <default>' lines).

Also tolerates a list, or JSON (even slightly broken), since models sometimes return those.
"""
import json
import re

JSON_FIELD = re.compile(r'"(group|question|default)"\s*:\s*"((?:[^"\\]|\\.)*)"')
LIST_PREFIX = re.compile(r"^\s*(\d+[.)]|[-*•])\s*")


def parse_questions(raw, groups, other):
    def make(group, question, default=""):
        group = (group or "").strip()
        return {"group": group if group in groups else other,
                "question": str(question).strip(), "default": str(default or "").strip()}

    if isinstance(raw, list):
        items = raw
    else:
        text = str(raw or "")
        try:
            items = json.loads(text)
        except ValueError:
            items = text.splitlines()
        if isinstance(items, dict):
            items = [items]

    result = []
    for item in items:
        if isinstance(item, dict):
            if item.get("question"):
                result.append(make(item.get("group"), item["question"], item.get("default")))
            continue
        line = str(item).strip().strip(",")
        if not line or line in "[]{}":
            continue
        if line.startswith("{"):
            fields = dict(JSON_FIELD.findall(line))
            if fields.get("question"):
                result.append(make(fields.get("group"), fields["question"], fields.get("default")))
            continue
        parts = [p.strip() for p in LIST_PREFIX.sub("", line).split("::")]
        if len(parts) >= 3:
            result.append(make(parts[0], parts[1], " :: ".join(parts[2:])))
        elif len(parts) == 2:
            result.append(make(parts[0], parts[1]) if parts[0] in groups else make("", parts[0], parts[1]))
        else:
            result.append(make("", parts[0]))
    return [q for q in result if q["question"]]


def group_in_order(questions, groups, other):
    """Yield (group, [questions]) in the configured order, numbering continuously."""
    for group in list(groups) + [other]:
        qs = [q for q in questions if q["group"] == group]
        if qs:
            yield group, qs
