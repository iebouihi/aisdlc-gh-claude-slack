---
name: refine-thread
description: Read a requirement refinement thread (the issue, related living specs and the Slack conversation) and decide the next step - wait, ask a follow-up, or propose the final requirement with its living spec updates. Use when new replies arrive in a refinement thread or a developer asks where a refinement stands.
argument-hint: [issue-number]
---

# Decide the next step in a refinement thread

## Inputs
- The issue (title, body, link).
- The **related living specs** (current content), chosen at kick-off by `impact-analysis`.
- The whole thread as a transcript, oldest first: `[Claude] …` for your own messages,
  `[Name] …` for team members. Your first message holds the numbered questions and defaults.
- The thread link.

## Decide
1. Map every numbered question to its answer, if any.
   - A direct answer counts ("3: 40 chars").
   - A blanket acceptance accepts the default of every question not otherwise answered:
     "ok", "rest ok", "defaults are fine", "choose the best options", "go forward" and similar.
   - Silence is not an answer.
2. Look for conflicts: two people giving different answers, an answer that contradicts another
   decision or the issue, or one that changes a **living spec decision** nobody explicitly agreed
   to change. Changing an existing decision needs an explicit yes in the thread.
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
- `spec_updates`: the living specs after this change, following the `living-spec` skill:
  the **full new content** of every capability spec to create or edit, each wrapped as

  ```
  === FILE: specs/<module>/<capability>.md ===
  <full file content, frontmatter included>
  === END FILE ===
  ```

  Edit existing specs in place (keep decision IDs, supersede changed ones, add a History line);
  create a new spec only for a new capability. Only important, lasting decisions go in specs.
- `slack_message`: the proposal for Slack, in Slack mrkdwn and compact (decisions and
  acceptance criteria as `•` bullets), ending with a short *Living spec changes* section:
  which spec files are created or edited, and every existing decision that changes
  ("`habits/habit-management` D3: unique names → duplicates allowed"). Do **not** add a title
  line or an "approve" prompt; the automation adds those.

## Output
- **Run by the automation:** call the tool named in `output.schema.json`.
- **Run by a developer** (`/refine-thread $ARGUMENTS`): find the thread link in the issue
  comments (`gh issue view $ARGUMENTS --comments`), read the thread with the Slack connector
  if available, and report the status: answered, open, conflicting, spec decisions affected,
  and what you would post.
