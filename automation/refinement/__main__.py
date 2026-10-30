"""Usage:
  python -m automation.refinement kickoff <issue_number>   open the Slack thread for a labelled issue
  python -m automation.refinement sync                     follow every thread in refinement
  python -m automation.refinement show-prompt [kickoff|thread]  print what Claude receives (no API calls)
"""
import os
import sys

from . import catalog, config
from .clients import Claude, GitHub, Slack
from .engine import Refinement

SECRETS = ("GITHUB_TOKEN", "SLACK_BOT_TOKEN", "ANTHROPIC_API_KEY")


def build(cfg):
    agent = catalog.load_agent(cfg["claude"]["agent"])
    claude = Claude(cfg["claude"]["model"], cfg["claude"]["max_tokens"],
                    cfg["tasks"]["tool_reminder"], cfg["tasks"]["tool_retry"])
    return Refinement(cfg, agent, GitHub(cfg["github"]["repo"]), Slack(), claude)


def show_prompt(cfg, step):
    agent = catalog.load_agent(cfg["claude"]["agent"])
    skill = agent.skill(cfg["claude"]["skills"][step])
    print("=== SYSTEM (agent + preloaded skills) ===\n" + agent.system_prompt(arguments="<n>"))
    print("\n=== TASK TEMPLATE ===\n" + cfg["tasks"][step])
    print("=== TOOL ===\n" + str(skill.tool))


def main(argv):
    cfg = config.load()
    if argv[:1] == ["show-prompt"]:
        return show_prompt(cfg, (argv[1:] or ["kickoff"])[0])
    missing = [s for s in SECRETS if not os.environ.get(s)]
    if missing:
        print(f"::warning::Refinement automation not configured, missing secrets: {', '.join(missing)}"
              " (see docs/automation-setup.md)")
        return
    if argv[:1] == ["kickoff"] and len(argv) == 2:
        build(cfg).kickoff(int(argv[1]))
    elif argv == ["sync"]:
        build(cfg).sync()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception as e:  # surface the reason as a GitHub annotation, not just "exit code 1"
        detail = getattr(getattr(e, "response", None), "text", "") or ""
        print(f"::error title=Refinement failed::{type(e).__name__}: {e} {detail[:500]}".replace("\n", " "))
        raise
