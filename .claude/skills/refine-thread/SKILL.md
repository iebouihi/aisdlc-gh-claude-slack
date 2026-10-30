---
name: refine-thread
description: Read a requirement refinement thread (the issue plus the Slack conversation) and decide the next step - wait, ask a follow-up, or propose the final requirement. Use when new replies arrive in a refinement thread or a developer asks where a refinement stands.
argument-hint: [issue-number]
---

# Decide the next step in a refinement thread

## Inputs
- The issue (title, body, link).
- The whole thread as a transcript, oldest first: `[Claude] …` for your own messages,
  `[Name] …` for team members. Your first message holds the numbered questions and defaults.
- The thread link.

## Decide
1. Map every numbered question to its answer, if any.
   - A direct answer counts ("3: 40 chars").
   - A blanket acceptance accepts the default of every question not otherwise answered:
     "ok", "rest ok", "defaults are fine", "choose the best options", "go forward" and similar.
   - Silence is not an answer.
2. Look for conflicts: two people giving different answers, or an answer that contradicts
   another decision or the issue.
3. If a proposal was already posted and someone asks for a change, apply the change if it is
   clear; ask only if it is ambiguous.
4. Pick one action:
   - `wait`: the latest replies need nothing from you (e.g. people are still discussing).
   - `follow_up`: something is unanswered, conflicting or ambiguous. Ask only about that,
     numbered, each with a suggested resolution. Name the people whose answers conflict.
   - `propose`: every question has an answer or an accepted default.

## When proposing
- `final_requirement`: the new issue body, in the exact format of the `requirement-format`
  skill, in GitHub Markdown. Every decision cites who made it ("Imad (accepted default)").
  The Refinement trace links the thread and says `Approved by: (pending)`.
- `slack_message`: the same content for Slack, in Slack mrkdwn and more compact
  (decisions and acceptance criteria as `•` bullets). Do **not** add a title line or an
  "approve" prompt; the automation adds those.

## Output
- **Run by the automation:** call the tool named in `output.schema.json`.
- **Run by a developer** (`/refine-thread $ARGUMENTS`): find the thread link in the issue
  comments (`gh issue view $ARGUMENTS --comments`), read the thread with the Slack connector
  if available, and report the status: answered, open, conflicting, and what you would post.
