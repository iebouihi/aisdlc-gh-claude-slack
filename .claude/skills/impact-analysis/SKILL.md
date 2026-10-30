---
name: impact-analysis
description: Find which living specs (modules, capabilities, decisions) a requirement touches, without reading the whole specs/ tree. Use before refining an issue, or when a developer asks what an issue or change affects.
argument-hint: [issue-number]
---

# Impact analysis

## Goal
Pick the **few** specs a requirement depends on or could change, so later steps load only
those. Precision beats recall: an irrelevant spec costs context; a missed one costs a question.

## How to choose
A spec is relevant when the requirement:
- uses or changes one of its **entities** (same data, same storage),
- extends or alters its **behaviour** or a flow it owns,
- could **contradict** one of its decisions (limits, validation, ordering, storage, UX rules),
- depends on it to work (e.g. check-ins need the habit `id` defined elsewhere).

Same words are a hint, not proof; match on meaning. Choose none if nothing applies.

## Output
One line per choice, most relevant first, at most the number you are given:

```
<id> :: <why, in a few words: entity / behaviour / possible conflict with D3>
```

- **Run by the automation:** you get an index (modules, or specs within chosen modules) and
  answer through the tool named in `output.schema.json`. The automation then loads the chosen
  specs for the refinement. For large repos it asks twice: first modules, then specs.
- **Run by a developer** (`/impact-analysis $ARGUMENTS`, or the `impact-analyst` agent):
  read the issue (`gh issue view $ARGUMENTS`), then `specs/README.md`, then only the module
  READMEs and specs that look relevant (grep entity names across `specs/`). Also list open bugs
  in the same area (`gh issue list --label bug --search "<entity>"`). Reply with a one-page
  brief: related specs, decisions at risk (by ID), dependencies, open bugs.
