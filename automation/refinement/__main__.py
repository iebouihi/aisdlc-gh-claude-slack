"""Usage:
  python -m automation.refinement kickoff <issue_number>      open the Slack thread for a labelled issue
  python -m automation.refinement sync                        follow every thread in refinement
  python -m automation.refinement dev-start <issue> <run_url> decide and prepare a developer agent run
  python -m automation.refinement dev-finish <issue> <run_url> report the agent's pull request
  python -m automation.refinement agent-args                  developer agent CLI args (for @claude runs)
  python -m automation.refinement pr-merged <pr_number>       merged spec PR -> ready; merged dev PR -> done
  python -m automation.refinement specs-index                 regenerate specs/**/README.md locally
  python -m automation.refinement show-prompt [select|kickoff|thread]  what Claude receives (no API calls)
"""
import os
import sys
from pathlib import Path

from . import catalog, config
from . import specs as spec_store
from .clients import Claude, GitHub, Slack
from .delivery import Delivery
from .engine import Refinement

SECRETS = ("GITHUB_TOKEN", "SLACK_BOT_TOKEN", "ANTHROPIC_API_KEY")
DELIVERY_SECRETS = ("GITHUB_TOKEN", "SLACK_BOT_TOKEN")


def build(cfg):
    agent = catalog.load_agent(cfg["claude"]["agent"])
    c = cfg["claude"]
    claude = Claude(c["model"], c["max_tokens"], cfg["tasks"]["tool_reminder"], cfg["tasks"]["tool_retry"],
                    cache=c.get("cache_system_prompt", True))
    return Refinement(cfg, agent, GitHub(cfg["github"]["repo"]), Slack(), claude)


def delivery(cfg):
    return Delivery(cfg, GitHub(cfg["github"]["repo"]), Slack())


def write_outputs(values):
    """Step outputs for GitHub Actions (also printed for local runs)."""
    target = os.environ.get("GITHUB_OUTPUT")
    lines = [f"{k}={v}" for k, v in values.items()]
    if target:
        with open(target, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    print("\n".join(lines))


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


def missing(names):
    gone = [s for s in names if not os.environ.get(s)]
    if gone:
        print(f"::warning::Automation not configured, missing secrets: {', '.join(gone)}"
              " (see docs/automation-setup.md)")
    return gone


def main(argv):
    cfg = config.load()
    if argv[:1] == ["show-prompt"]:
        return show_prompt(cfg, (argv[1:] or ["kickoff"])[0])
    if argv == ["specs-index"]:
        return specs_index(cfg)
    if argv == ["agent-args"]:
        return write_outputs(Delivery(cfg, None, None).agent_args())
    if argv[:1] in (["dev-start"], ["dev-finish"], ["pr-merged"], ["spec-merged"]):
        if missing(DELIVERY_SECRETS):
            return write_outputs({"go": "false"}) if argv[0] == "dev-start" else None
        if argv[0] == "dev-start" and len(argv) == 3:
            return write_outputs(delivery(cfg).start(int(argv[1]), argv[2]))
        if argv[0] == "dev-finish" and len(argv) == 3:
            return delivery(cfg).finish(int(argv[1]), argv[2])
        if argv[0] in ("pr-merged", "spec-merged") and len(argv) == 2:
            return delivery(cfg).pr_merged(int(argv[1]))
        sys.exit(__doc__)
    if missing(SECRETS):
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
        print(f"::error title=Automation failed::{type(e).__name__}: {e} {detail[:500]}".replace("\n", " "))
        raise
