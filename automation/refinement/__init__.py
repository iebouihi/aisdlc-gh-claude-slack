"""Requirement refinement automation: GitHub issues <-> Claude <-> Slack.

The instructions live outside this package:
  .claude/agents/requirements-refiner.md   who Claude is (system prompt) + which skills to preload
  .claude/skills/<skill>/SKILL.md          how each step is done
  .claude/skills/<skill>/output.schema.json the structured answer the automation expects
  config/refinement.yml                    settings, task prompts and every posted message
This package only moves data between GitHub, Slack and Claude.
"""
