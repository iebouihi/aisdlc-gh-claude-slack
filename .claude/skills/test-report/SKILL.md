---
name: test-report
description: The exact format of the tester's report (.agent/test-report.md) - frontmatter verdict and summary, then acceptance criteria coverage, regression results, impacted features, accessibility, exploratory findings, flaky tests and questions. Use when writing or checking a test report.
---

# Test report format

Write the report to the file you were given (default `.agent/test-report.md`). The automation
reads the frontmatter, posts the body on the issue and the pull request, and puts the summary in
Slack. Write it for a person who decides in two minutes whether to approve the merge.

```markdown
---
verdict: pass            # pass | fail | blocked
summary: <one sentence: what was tested and the outcome>
acceptance: <passed>/<total>   # e.g. 6/7
regressions: <number of regressions found>
---
### Acceptance criteria
| AC | Test | Desktop | Mobile |
|---|---|---|---|
| AC1 | `issue-12.spec.ts` › "AC1 (#12): …" | ✅ | ✅ |
| AC2 | unit only: `habits.test.ts` › "AC2 (#12): …" (no UI effect) | ✅ | n/a |
| AC3 | `issue-12.spec.ts` › "AC3 (#12): …" | ❌ expected "…", got "…" | ❌ |

### Regression suite
- <n> tests run (desktop + mobile), <n> passed, <n> failed, <n> known (`test.fail`).
- Failures: <test name> → <regression | intended change | locator fixed | flaky>, with evidence.

### Impacted existing features
| Feature (spec) | Expected (from the issue) | Result |
|---|---|---|
| `habits/weekly-overview` | keeps working | ✅ covered by `core-flows.spec.ts` › … |
| `habits/habit-management` D3 | changes to … | ✅ test updated to AC4 |

### Accessibility
- axe (WCAG 2.1 AA) on <screens>: <no violations | violations with rule and element>.
- Keyboard and focus: <result>.

### Exploratory findings
- **[high]** <title>: steps → expected (AC/spec) → actual. Evidence: `<path>`.
- or "None"

### Flaky tests
- <test> failed <x>/3 runs: <suspected cause>, or "None"

### Tests added or changed
- Added: <files and count>. Changed: <test → why (regression-guard category)>.

### Not tested
- <what and why>, or "None"

### Questions for the reviewer
- <anything that needs a person's decision>, or "None"
```

Rules:
- `verdict: fail` when any AC fails, any regression is found, or a high finding breaks a spec
  decision. `blocked` when the build or the app could not run. Otherwise `pass`.
- Every AC from the issue appears in the table. No ✅ without a test that ran.
- Facts only: exact texts, test names, file paths. No marketing language.
