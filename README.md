# good-habit-tracker · AI-integrated SDLC demo

A demo of an AI-assisted requirements flow: requirements live in **GitHub issues**, get
refined with the team by **Claude** in a **Slack** thread, and the approved result
(decisions, acceptance criteria, scope) is written back to the issue.

The product used for the demo is **good-habit-tracker**, a small static Next.js app for
tracking daily habits (data kept in the browser, no backend).

## How it works

```
GitHub issue ──label: needs-refinement──► Claude opens a thread in #claude-app
                                                │ team answers questions
                                                ▼
                                   Claude posts PROPOSED FINAL REQUIREMENT
                                                │ PO reacts ✅
                                                ▼
GitHub issue ◄── body updated, label: ready-for-dev ── Claude writes back
```

Full playbook: [docs/refinement-workflow.md](docs/refinement-workflow.md)

## Automation

It runs on its own through GitHub Actions: labelling an issue `needs-refinement` starts
the Slack thread within a minute, and a sync job every 10 minutes handles replies,
the proposal and the ✅ write-back. One-time setup (Slack app + 2 secrets):
[docs/automation-setup.md](docs/automation-setup.md)

## Use it

1. Open an issue with the **Requirement** template (it adds `needs-refinement`).
2. Answer Claude's questions in the Slack thread.
3. When the proposal looks right, the PO reacts ✅.
4. The issue becomes `ready-for-dev` with acceptance criteria.

## Labels

`needs-refinement` → `in-refinement` → `ready-for-dev` (or `blocked`)
