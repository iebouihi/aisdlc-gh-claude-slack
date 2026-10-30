# Instructions for Claude

This repo runs the requirement refinement workflow for **good-habit-tracker**
(process: `docs/refinement-workflow.md`).

## Agents and skills (shared with the automation)
- Agent `requirements-refiner` (`.claude/agents/`) preloads the skills `refine-kickoff`,
  `refine-thread` and `requirement-format` (`.claude/skills/`).
- The GitHub Actions automation loads these same files as Claude's instructions. Changing a
  skill changes what the automation does - keep each skill's `output.schema.json` in sync with
  its "Output" section.
- Settings and every text the automation posts: `config/refinement.yml`. Never hardcode
  instructions, messages, IDs or label names in `automation/`.

## Working on the code
- GitHub access: REST API (`gh api repos/<repo>/...`); GraphQL is unavailable here.
- Run the tests after any change to `automation/`, `.claude/` or `config/`:
  `python -m automation.tests.test_refinement`
- See exactly what Claude receives: `python -m automation.refinement show-prompt kickoff|thread`
- The app itself (Next.js, static export) will live in `app/` once requirements are ready for dev.
