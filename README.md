# good-habit-tracker · AI-integrated SDLC demo

A demo of an AI-assisted requirements flow: requirements live in **GitHub issues**, get
refined with the team by **Claude** in a **Slack** thread, and the approved result
(decisions, acceptance criteria, scope) is written back to the issue.

The product used for the demo is **good-habit-tracker**, a small static Next.js app for
tracking daily habits (data kept in the browser, no backend).

## How it works

```
GitHub issue ──label: needs-refinement──► Claude opens a thread in Slack
                                                │ team answers questions
                                                ▼
                                   Claude posts PROPOSED FINAL REQUIREMENT
                                                │ PO approves (✅)
                                                ▼
GitHub issue ◄── body updated, label: ready-for-dev ── written back
```

Process: [docs/refinement-workflow.md](docs/refinement-workflow.md)

## Repository layout

```
.claude/
  agents/requirements-refiner.md      the agent: role, principles, preloaded skills
  skills/
    refine-kickoff/                   open a refinement   (SKILL.md + output.schema.json)
    refine-thread/                    decide the next step (SKILL.md + output.schema.json)
    requirement-format/               the final requirement format
config/refinement.yml                 settings + every prompt and message text
automation/
  refinement/                         Python runner: GitHub ⇄ Slack ⇄ Claude plumbing only
  tests/                              offline tests of the whole loop
.github/workflows/                    refine-kickoff (on label), refine-sync (every 10 min), tests
docs/                                 process, setup, Slack app manifest
```

**One source of instructions, two ways to use it.** The agent and skills are standard
Claude Code files:

- **The automation** loads `requirements-refiner.md` + its skills as Claude's system prompt,
  sends the issue and thread as data, and reads the answer through each skill's
  `output.schema.json`. Preview it with `python -m automation.refinement show-prompt kickoff`.
- **Developers** in Claude Code use the same files directly:
  - `/refine-kickoff 3`: draft the questions for issue #3
  - `/refine-thread 1`: where does the refinement of #1 stand?
  - "use the requirements-refiner agent to check #2's acceptance criteria"

Change how Claude refines by editing a skill; change wording, labels, channel or model in
`config/refinement.yml`. The Python code holds no instructions (a test enforces it).

## Automation

Labelling an issue `needs-refinement` starts the Slack thread within a minute; a sync job
every 10 minutes handles replies, the proposal and the write-back after approval.
One-time setup (Slack app + 2 secrets): [docs/automation-setup.md](docs/automation-setup.md)

## Use it

1. Open an issue with the **Requirement** template (it adds `needs-refinement`).
2. Answer Claude's questions in the Slack thread ("3: yes", or "rest ok" for the defaults).
3. The PO approves the proposal: ✅ reaction, or reply "approved".
4. The issue becomes `ready-for-dev` with acceptance criteria.

Tests: `pip install -r automation/requirements.txt && python -m automation.tests.test_refinement`
