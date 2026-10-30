"""Usage:
  python -m automation.refinement kickoff <issue_number>      open the Slack thread for a labelled issue
  python -m automation.refinement sync                        follow every thread in refinement
  python -m automation.refinement spec-merged <pr_number>     a merged living spec PR: issue -> ready for dev
  python -m automation.refinement specs-index                 regenerate specs/**/README.md locally
  python -m automation.refinement show-prompt [select|kickoff|thread]  what Claude receives (no API calls)
"""
import os
import sys
from pathlib import Path

from . import catalog, config
from . import specs as spec_store
from .clients import Claude, GitHub, Slack
from .engine import Refinement

SECRETS = ("GITHUB_TOKEN", "SLACK_BOT_TOKEN", "ANTHROPIC_API_KEY")


def build(cfg):
    agent = catalog.load_agent(cfg["claude"]["agent"])
    c = cfg["claude"]
    claude = Claude(c["model"], c["max_tokens"], cfg["tasks"]["tool_reminder"], cfg["tasks"]["tool_retry"],
                    cache=c.get("cache_system_prompt", True))
    return Refinement(cfg, agent, GitHub(cfg["github"]["repo"]), Slack(), claude)


def show_prompt(cfg, step):
    agent = catalog.load_agent(cfg["claude"]["agent"])
    conf = cfg["claude"]["steps"][step]
    system = agent.system_prompt(arguments="<n>", only=[conf["skill"]] + list(conf.get("uses", [])))
    print("=== SYSTEM (agent + step skills) ===\n" + system)
    print("\n=== TASK TEMPLATE ===\n" + cfg["tasks"][step])
    print("=== TOOL ===\n" + str(agent.skill(conf["skill"]).tool))
    print(f"\n=== SIZE === system {len(system)} chars")


def specs_index(cfg):
    sp = cfg["specs"]
    found = spec_store.load(config.ROOT, sp["dir"])
    for path, content in spec_store.generated_files(found, sp["generated"], cfg["product"]["name"], sp["dir"]).items():
        (config.ROOT / path).parent.mkdir(parents=True, exist_ok=True)
        Path(config.ROOT / path).write_text(content, encoding="utf-8")
        print(path)


def main(argv):
    cfg = config.load()
    if argv[:1] == ["show-prompt"]:
        return show_prompt(cfg, (argv[1:] or ["kickoff"])[0])
    if argv == ["specs-index"]:
        return specs_index(cfg)
    missing = [s for s in SECRETS if not os.environ.get(s)]
    if missing:
        print(f"::warning::Refinement automation not configured, missing secrets: {', '.join(missing)}"
              " (see docs/automation-setup.md)")
        return
    if argv[:1] == ["kickoff"] and len(argv) == 2:
        build(cfg).kickoff(int(argv[1]))
    elif argv == ["sync"]:
        build(cfg).sync()
    elif argv[:1] == ["spec-merged"] and len(argv) == 2:
        build(cfg).spec_merged(int(argv[1]))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception as e:  # surface the reason as a GitHub annotation, not just "exit code 1"
        detail = getattr(getattr(e, "response", None), "text", "") or ""
        print(f"::error title=Refinement failed::{type(e).__name__}: {e} {detail[:500]}".replace("\n", " "))
        raise
