# Requirement Refinement Workflow (GitHub ⇄ Claude ⇄ Slack)

This is the playbook Claude follows when refining requirements for **good-habit-tracker**.
Humans can read it to know what to expect; Claude reads it before every run.

## Actors

| Who | Role |
|---|---|
| Product Owner (PO) | Writes requirements as GitHub issues, approves the final version |
| Team (dev, QA, design) | Answers questions in the Slack thread |
| Claude | Facilitates refinement, drafts the result, writes it back to GitHub |

- **Repo:** `iebouihi/aisdlc-gh-claude-slack`
- **Slack channel:** `#claude-app` (one thread per issue)
- **Approver:** the PO (`@Imad Eddine B`)

Automation: `refine-kickoff.yml` runs step 2 the moment the label is added;
`refine-sync.yml` runs steps 3–7 every 10 minutes. See `docs/automation-setup.md`.

## States (GitHub labels)

```
needs-refinement ──► in-refinement ──► ready-for-dev
                          │
                          └──► blocked  (no answer for 3 working days)
```

| Label | Meaning | Who sets it |
|---|---|---|
| `needs-refinement` | Requirement written, ready for Claude to pick up | PO |
| `in-refinement` | A Slack thread is open and the discussion is ongoing | Claude |
| `ready-for-dev` | Approved, issue body holds the final requirement | Claude, after approval |
| `blocked` | Waiting on an answer for too long | Claude |

## Steps

### 1. Intake — GitHub
The PO opens an issue with the **Requirement** template and adds `needs-refinement`.
Issues without that label are ignored.

### 2. Kick-off — Slack
For each `needs-refinement` issue, Claude:
1. Posts a **top-level message** in `#claude-app`:
   `🧩 Refinement: #<n> <title>` + issue link + one-paragraph restatement.
2. Replies **in the thread** with numbered questions, grouped as:
   *Scope · Behaviour & edge cases · Data · UX · Non-functional · Dependencies & risks*.
   Each question proposes a default answer so the team can just say "ok".
3. Comments on the issue: `Refinement started in Slack: <thread link>` and records the
   thread timestamp in a hidden marker `<!-- slack-thread: <channel_id>/<ts> -->`.
4. Swaps the label `needs-refinement` → `in-refinement`.

### 3. Refinement — Slack thread
The team answers in the thread. On each run Claude reads new replies and:
- asks follow-ups where answers conflict or leave gaps;
- never invents a decision — unanswered questions stay open (or use the stated default
  only if someone explicitly accepts it).

### 4. Proposal — Slack thread
When every question is answered, Claude posts a reply starting with
`📋 PROPOSED FINAL REQUIREMENT` using the **Final requirement format** below,
and ends with: *React ✅ to approve, or reply with changes.*

### 5. Approval
Only a ✅ (`white_check_mark`) reaction **from the approver** on the proposal counts.
If someone replies with changes instead, Claude revises and posts a new proposal.

### 6. Write-back — GitHub
After approval Claude:
1. Replaces the issue body with the final requirement (original text kept in a collapsed
   `<details>` block at the bottom).
2. Comments: `✅ Approved by <name> in Slack: <link>` + one-line summary of what changed.
3. Swaps `in-refinement` → `ready-for-dev`.
4. Replies in the thread: `Done — #<n> is ready for dev: <issue link>`.

### 7. Nudge / blocked
If a thread has no new reply for 3 working days, Claude pings the open questions once.
After 3 more days, it adds `blocked` and says so in the thread.

## Final requirement format

```markdown
## Summary
<2–3 sentences: who, what, why>

## User story
As a <user>, I want <capability>, so that <benefit>.

## Decisions
| # | Decision | Decided by | Source |
|---|---|---|---|
| D1 | ... | @name | Slack thread |

## Acceptance criteria
- [ ] **AC1** Given ..., when ..., then ...
- [ ] **AC2** ...

## Out of scope
- ...

## Open risks / follow-ups
- ...

## Refinement trace
- Slack thread: <link>
- Approved by: @name on <date>
```

## Rules for Claude
- GitHub issue = source of truth. Slack = the reasoning.
- Never change the issue body before approval.
- Never mark `ready-for-dev` without the approver's ✅.
- Keep Slack messages short; questions numbered so people can answer "3: yes".
- Post only in `#claude-app`, only in the issue's own thread (except the kick-off message).
