# Requirement Refinement Workflow (GitHub ⇄ Claude ⇄ Slack)

How a rough requirement for **good-habit-tracker** becomes an approved, testable one.
This page is the process overview. The instructions Claude follows live in the agent and
skill files, and every setting and message text lives in the config:

| What | Where |
|---|---|
| Who Claude is, its principles | `.claude/agents/requirements-refiner.md` |
| How to open a refinement | `.claude/skills/refine-kickoff/SKILL.md` |
| How to decide the next step in a thread | `.claude/skills/refine-thread/SKILL.md` |
| The final requirement format | `.claude/skills/requirement-format/SKILL.md` |
| Channel, approver, labels, groups, model, task prompts, all posted texts | `config/refinement.yml` |
| Plumbing between GitHub, Slack and Claude | `automation/refinement/` |

## Actors

| Who | Role |
|---|---|
| Product Owner (PO) | Writes requirements as GitHub issues; the configured approver |
| Team (dev, QA, design) | Answers questions in the Slack thread |
| Claude (`requirements-refiner` agent) | Facilitates refinement, drafts the result |
| Automation (GitHub Actions) | Runs the agent, posts to Slack, updates GitHub |

## States (GitHub labels)

```
needs-refinement ──► in-refinement ──► ready-for-dev
                          │
                          └──► blocked  (no answer after a nudge)
```

## Steps

1. **Intake.** The PO opens an issue with the *Requirement* template, which adds `needs-refinement`.
2. **Kick-off** (`refine-kickoff`, instant). Claude restates the issue and asks numbered questions
   with proposed defaults. The automation opens a thread in the channel, links it on the issue
   and moves the issue to `in-refinement`.
3. **Refinement** (`refine-thread`, every 10 min). On new replies Claude asks follow-ups about
   gaps or conflicts. "ok" / "rest ok" accepts the remaining defaults.
4. **Proposal.** When everything is answered, Claude drafts the final requirement in the
   `requirement-format` format; it is posted in the thread and saved on the issue.
5. **Approval.** Only the approver: a ✅ reaction on the proposal, or a reply that is only an
   approval ("✅", "approved", "lgtm"). Any other reply is treated as a change request.
   Approval is checked by the automation, never decided by Claude.
6. **Write-back.** The issue body becomes the final requirement (original kept in a collapsed
   block), a comment links the thread, the label becomes `ready-for-dev`, and the thread is told.
7. **Nudge / blocked.** A quiet thread gets a nudge, then `blocked`; a new reply resumes it.

## Rules
- GitHub issue = source of truth; Slack = the reasoning.
- The issue body changes only after approval.
- Claude never invents decisions; every decision in the final requirement names who made it.
