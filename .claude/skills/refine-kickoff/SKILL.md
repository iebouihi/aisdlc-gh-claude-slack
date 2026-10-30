---
name: refine-kickoff
description: Open the refinement of a requirement (GitHub issue) by restating it and asking the few questions that matter, each with a proposed default. Use when an issue is labelled needs-refinement or a developer asks to start refining an issue.
argument-hint: [issue-number]
---

# Open a requirement refinement

## Goal
Give the team a fast way to sharpen one requirement: a plain restatement they can confirm,
and a short list of numbered questions they can answer with "3: yes" or accept with "ok".

## Steps
1. Read the issue: title, body, and any constraints it states.
2. Restate it in one short paragraph: who needs what, and why. Keep the issue's own constraints.
3. Find what is unclear or missing for a developer and a tester. Look at each question group
   (listed in `config/refinement.yml` under `refinement.question_groups`), for example scope
   boundaries, edge cases and validation, data stored, empty and error states, accessibility,
   and dependencies on other requirements.
4. Keep only the questions whose answer would change what gets built or tested:
   at least 3, at most 15. Skip anything the issue already answers.
5. For each question, propose the default you would recommend, phrased as the decision itself
   ("Max 60 characters, trimmed; empty names show an inline error.").
6. Out of scope for this issue? Ask whether to exclude it rather than designing it.

## Output
One line per question, exactly:

```
<group> :: <question> :: <proposed default>
```

`<group>` must be one of the configured question groups. No numbering, no JSON, no bullets.

- **Run by the automation:** call the tool named in `output.schema.json` with `restatement`
  and `questions` (the lines above as one string). The automation numbers and posts them.
- **Run by a developer** (`/refine-kickoff $ARGUMENTS`): read the issue with
  `gh issue view $ARGUMENTS`, then show the restatement and the numbered questions grouped by
  group in the chat. Post nothing unless asked.
