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
1. Read the issue: title, body, and any constraints it states. Read the **related living specs**
   you are given (chosen by `impact-analysis`): they describe how the product works today.
2. Restate it in one short paragraph: who needs what, and why. Keep the issue's own constraints.
   Mention which existing capabilities it builds on, if any.
3. Don't ask what a related spec already decides; treat it as given and build on it.
   If the issue **contradicts or changes** a spec decision, ask about it explicitly, quoting it:
   "This changes `habits/habit-management` D3 (names are unique). Change it, or keep it?"
   Put these questions first, in the group they belong to.
4. Find what is unclear or missing for a developer and a tester. Look at each question group
   (listed in `config/refinement.yml` under `refinement.question_groups`), for example scope
   boundaries, edge cases and validation, data stored, empty and error states, accessibility,
   and dependencies on other requirements.
5. Keep only the questions whose answer would change what gets built or tested:
   at least 3, at most 15. Skip anything the issue or a related spec already answers.
6. For each question, propose the default you would recommend, phrased as the decision itself
   ("Max 60 characters, trimmed; empty names show an inline error."). Defaults should stay
   consistent with existing spec decisions unless the issue asks to change them.
7. Out of scope for this issue? Ask whether to exclude it rather than designing it.

## Output
One line per question, exactly:

```
<group> :: <question> :: <proposed default>
```

`<group>` must be one of the configured question groups. No numbering, no JSON, no bullets.

- **Run by the automation:** call the tool named in `output.schema.json` with `restatement`
  and `questions` (the lines above as one string). The automation numbers and posts them.
- **Run by a developer** (`/refine-kickoff $ARGUMENTS`): read the issue with
  `gh issue view $ARGUMENTS`, run the `impact-analysis` skill (or the `impact-analyst` agent)
  to find related specs, then show the restatement and the numbered questions grouped by
  group in the chat. Post nothing unless asked.
