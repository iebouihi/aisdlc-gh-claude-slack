# Instructions for Claude

This repo runs the requirement refinement workflow for **good-habit-tracker**
(process: `docs/refinement-workflow.md`).

## Product context: start here
- `specs/README.md` is the map of how the product works today (modules → capabilities).
  Read it before working on any feature, then only the specs that matter for the task.
- Specs describe current behaviour with stable decision IDs. Don't contradict a spec decision
  in code or requirements; changing one goes through a refinement and a spec PR.
- `specs/**/README.md` are generated (`python -m automation.refinement specs-index`); don't edit.
- For impact research across many specs, use the `impact-analyst` agent and work from its brief.

## Agents and skills (shared with the automation)
- Agent `requirements-refiner` (`.claude/agents/`) preloads `impact-analysis`, `refine-kickoff`,
  `refine-thread`, `requirement-format` and `living-spec` (`.claude/skills/`).
- The GitHub Actions automation loads these same files as Claude's instructions (only the skills
  each step needs: `config/refinement.yml` → `claude.steps`). Changing a skill changes what the
  automation does - keep each skill's `output.schema.json` in sync with its "Output" section.
- Settings and every text the automation posts: `config/refinement.yml`. Never hardcode
  instructions, messages, IDs or label names in `automation/`.

## Design (design/)
- After the spec PR is merged an issue is `ready-for-design`: a person adds `design` to start the
  `designer` agent (`design-feature` skill), or `skip-design` to go straight to `ready-for-dev`.
- The designer writes `design/issue-<n>/technical-spec.md` and `design/issue-<n>/mockup.html`
  (self-contained, real design tokens) and updates `design/TECHNICAL-DECISIONS.md`, the living
  summary of technical choices (`TD<n>`), in one PR. Merging it makes the issue `ready-for-dev`.
- Review remarks: mentioning @Claude in the issue's Slack thread during `design-review` makes the
  sync job post the remarks on the issue and rerun the designer on the same PR (mode revise);
  `@claude` on the PR works too.
- The designer may change only `design/` (`.claude/designer-settings.json`, enforced again in CI).
- Read `design/TECHNICAL-DECISIONS.md` before designing or building; don't contradict a `TD<n>`
  silently (supersede it in a design PR).

## The app (app/)
- Read `app/ARCHITECTURE.md` (the living code map) before changing code; keep it true.
- Build from the merged design in `design/issue-<n>/` when it exists.
- Implement issues with the `developer` agent / `implement-issue` skill: tests named after
  acceptance criteria (`AC3 (#1): …`), `npm run check` in `app/` must pass.
- The developer agent may change only `app/` (`.claude/developer-settings.json`, enforced again
  in CI). Specs change through refinement; workflows, skills and config through human PRs.

## Test phase (app/e2e/)
- When the developer agent opens a feature or fix PR, the `tester` agent (`test-feature` skill)
  writes Playwright tests for every acceptance criterion (`app/e2e/features/issue-<n>.spec.ts`,
  named `AC3 (#n): …`), runs the whole regression suite (`npm run build && npm run e2e`: desktop,
  mobile, axe) and explores; its report goes on the issue, the PR and Slack (`test-review`).
- A person approves with `qa-approved` (sets the `QA` commit status to success); `test` re-tests.
- The tester may change only `app/e2e/**` and its report (`.claude/tester-settings.json`).
- A failing existing test is a regression unless the issue's "Impact on existing features" says
  that behaviour changes (`regression-guard`). Never weaken a test to make it pass.

## Impact on existing features
- Every final requirement has an "Impact on existing features" table (`requirement-format`):
  `changes` rows (existing behaviour that changes, with an AC and the superseded decision) and
  `keeps working` rows (regression scope). The designer designs it, the developer updates the
  impacted features and their tests, the tester verifies both.

## Token usage
- Every Claude call is recorded per issue and phase (`automation/refinement/usage.py`, config
  `usage`): refinement steps from the API response's `usage`, agent runs from Claude Code's
  `execution_file` (`python -m automation.refinement usage <issue|branch> <phase> <step>` in each
  agent workflow). Two outputs: one "Token usage" comment on the issue (a table, edited in place)
  and `token-usage/issue-<n>-<title>.csv` on the orphan `metrics` branch (never main).

## Bugs
- Bugs (issue type **Bug**, or the `bug` label: issue types can't be set on personal repos): `need-fix` starts the `bug-investigator` agent (root cause, no code
  changes, report format in `root-cause-report`); `fix-approved` (after validation) starts the
  `developer` agent with the `fix-bug` skill. Regression tests are named `BUG #<n>: …`.

## Working on the code
- GitHub access: REST API (`gh api repos/<repo>/...`); GraphQL is unavailable here.
- Run the tests after any change to `automation/`, `.claude/` or `config/`:
  `python -m automation.tests.test_refinement`
- See exactly what Claude receives: `python -m automation.refinement show-prompt select|kickoff|thread`
