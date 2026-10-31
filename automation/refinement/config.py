"""Loads config/refinement.yml and applies environment overrides."""
import os
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "config" / "refinement.yml"

# setting path in the YAML -> environment variable that overrides it
ENV_OVERRIDES = {
    ("github", "repo"): "GITHUB_REPOSITORY",
    ("slack", "channel_id"): "SLACK_CHANNEL_ID",
    ("slack", "approver_id"): "SLACK_APPROVER_ID",
    ("claude", "model"): "CLAUDE_MODEL",
    ("delivery", "model"): "DEV_CLAUDE_MODEL",
    ("bugs", "investigator", "model"): "BUG_CLAUDE_MODEL",
}


def load(path=CONFIG_PATH, env=os.environ):
    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    for path, var in ENV_OVERRIDES.items():
        if env.get(var):
            node = cfg
            for key in path[:-1]:
                node = node[key]
            node[path[-1]] = env[var].strip()
    return cfg
