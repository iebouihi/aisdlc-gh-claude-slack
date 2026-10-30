# good-habit-tracker · AI-integrated SDLC demo

A demo of an AI-assisted requirements flow: requirements live in **GitHub issues**, get
refined with the team by **Claude** in a **Slack** thread, and once approved they update the
**living specs** in `specs/`, the shared context every agent and developer works from.

The product used for the demo is **good-habit-tracker**, a small static Next.js app for
tracking daily habits (data kept in the browser, no backend).

## How it works

```
GitHub issue ──label: needs-refinement──► impact analysis: which specs does it touch?
                                                │
                                   Claude opens a thread in Slack, building on those specs
                                                │ team answers questions
                                                ▼
                       PROPOSED FINAL REQUIREMENT + living spec changes
                                                │ PO approves (✅)
                                                ▼
             issue body updated · spec PR opened and announced in Slack   [spec-review]
                                                │ PR merged
                                                ▼
                       specs/ updated for everyone · issue ready-for-dev
```

Process: [docs/refinement-workflow.md](docs/refinement-workflow.md)

## Repository layout

```
.claude/
  agents/
    requirements-refiner.md           refines issues; preloads the five skills below
    impact-analyst.md                 research subagent for developers: returns a 1-page brief
  skills/
    impact-analysis/                  pick the specs an issue touches   (SKILL.md + output.schema.json)
    refine-kickoff/                   open a refinement                 (SKILL.md + output.schema.json)
    refine-thread/                    decide the next step              (SKILL.md + output.schema.json)
    requirement-format/               the final requirement format
    living-spec/                      spec format and update rules
specs/                                living specs: one file per capability + generated indexes
config/refinement.yml                 settings, budgets, prompts and every posted text
automation/
  refinement/                         Python runner: GitHub ⇄ Slack ⇄ Claude ⇄ git plumbing only
  tests/                              offline tests of the whole loop
.github/workflows/                    refine-kickoff, refine-sync, refine-spec-merged, tests
docs/                                 process, setup, Slack app manifest
```

**One source of instructions, two ways to use it.** The agents and skills are standard
Claude Code files:

- **The automation** loads the agent plus only the skills each step needs as Claude's system
  prompt (cached between runs), sends the issue, related specs and thread as data, and reads the
  answer through each skill's `output.schema.json`.
  Preview: `python -m automation.refinement show-prompt select|kickoff|thread`.
- **Developers** in Claude Code use the same files directly:
  - `/impact-analysis 4` or "use the impact-analyst agent on #4": what does #4 touch?
  - `/refine-kickoff 3`: draft the questions for issue #3
  - `/refine-thread 1`: where does the refinement of #1 stand?
  - "read `specs/` and implement #2": the specs are the context for building

Change how Claude works by editing a skill; change wording, labels, channel, budgets or model
in `config/refinement.yml`. The Python code holds no instructions (a test enforces it).

## Context that scales
Agents never load all specs or issues: a compact generated index is searched in two stages
(modules, then specs), only a few specs are loaded within a character budget, and approved
requirements edit the existing capability specs instead of piling up new files.

## Automation
Labelling an issue `needs-refinement` starts the Slack thread within a minute; a sync job
every 10 minutes handles replies, the proposal and the approval; merging the spec PR marks the
issue ready. One-time setup: [docs/automation-setup.md](docs/automation-setup.md)

## Use it
1. Open an issue with the **Requirement** template (it adds `needs-refinement`).
2. Answer Claude's questions in the Slack thread ("3: yes", or "rest ok" for the defaults).
3. The PO approves the proposal: ✅ reaction, or reply "approved".
4. Review and merge the living spec PR announced in Slack; the issue becomes `ready-for-dev`.

Tests: `pip install -r automation/requirements.txt && python -m automation.tests.test_refinement`
