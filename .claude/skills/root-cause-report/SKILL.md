---
name: root-cause-report
description: The exact format of a bug root-cause report - frontmatter verdict, confidence and summary, then reproduction, expected vs actual with spec references, root cause, fix plan, test plan and open questions. Use when writing or checking a bug analysis.
---

# Root-cause report

A person validates the fix from this report, so it must be short, precise and checkable.
Write it as a Markdown file with YAML frontmatter. The automation reads the frontmatter to set
labels and posts the rest on the issue.

~~~markdown
---
verdict: bug            # bug | spec-gap | not-a-bug | needs-info | cannot-reproduce
confidence: high        # high | medium | low
summary: <one line, plain words: what is wrong and why>
---
### Reproduction
- Steps: <the minimal steps>
- Failing test: `<file>` › "BUG #<n>: …" (fails with: <assertion message>)

<details><summary>Reproduction test</summary>

```ts
<the test code>
```

</details>

### Expected vs actual
- Expected: <behaviour>, per `<module>/<capability>` <D-id> / AC<n> of #<issue>
- Actual: <behaviour>

### Root cause
<2–5 sentences: the code (file, function) and why it produces the wrong result; when it was
introduced if known (#issue / commit)>

### Fix plan
- <smallest change: files and functions>
- Blast radius: <what else uses this code, which tests cover it>
- Not changing: <anything nearby that stays as is>

### Test plan
- Keep the reproduction test as the regression test: "BUG #<n>: …"
- <any extra case worth covering>

### Open questions
- <for the validator or reporter, or "None">
~~~

## Rules
- Cite spec decisions and acceptance criteria by ID; never paraphrase a spec as if it were the
  rule without the reference.
- `spec-gap` and `not-a-bug`: no fix plan; say which behaviour must be decided, and by whom.
- `needs-info` and `cannot-reproduce`: list the exact questions for the reporter.
- Low confidence is fine if stated; an invented certainty is not.
- Keep it under ~120 lines (the reproduction test can be longer, inside `<details>`).
