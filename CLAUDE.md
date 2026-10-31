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

## The app (app/)
- Read `app/ARCHITECTURE.md` (the living code map) before changing code; keep it true.
- Implement issues with the `developer` agent / `implement-issue` skill: tests named after
  acceptance criteria (`AC3 (#1): …`), `npm run check` in `app/` must pass.
- The developer agent may change only `app/` (`.claude/developer-settings.json`, enforced again
  in CI). Specs change through refinement; workflows, skills and config through human PRs.

## Bugs
- Bugs (issue type **Bug**, or the `bug` label: issue types can't be set on personal repos): `need-fix` starts the `bug-investigator` agent (root cause, no code
  changes, report format in `root-cause-report`); `fix-approved` (after validation) starts the
  `developer` agent with the `fix-bug` skill. Regression tests are named `BUG #<n>: …`.

## Working on the code
- GitHub access: REST API (`gh api repos/<repo>/...`); GraphQL is unavailable here.
- Run the tests after any change to `automation/`, `.claude/` or `config/`:
  `python -m automation.tests.test_refinement`
- See exactly what Claude receives: `python -m automation.refinement show-prompt select|kickoff|thread`
