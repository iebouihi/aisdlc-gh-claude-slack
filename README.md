# good-habit-tracker · AI-integrated SDLC demo

A demo of an AI-assisted requirements flow: requirements live in **GitHub issues**, get
refined with the team by **Claude** in a **Slack** thread, and once approved they update the
**living specs** in `specs/`, the shared context every agent and developer works from. A
**designer agent** then writes the technical spec and an HTML mockup before any code is built.

The product used for the demo is **good-habit-tracker**, a small static Next.js app for
tracking daily habits (data kept in the browser, no backend).

## How it works

```
GitHub issue ──label: needs-refinement──► impact analysis: which specs does it touch?
                                                │
                                   Claude opens a thread in Slack, building on those specs
                                                │ team answers questions
                                                ▼
                       PROPOSED FINAL REQUIREMENT + living spec changes
                                                │ PO approves (✅)
                                                ▼
             issue body updated · spec PR opened and announced in Slack   [spec-review]
                                                │ PR merged
                                                ▼
                       specs/ updated for everyone · issue ready-for-design
                                                │ a person adds: design   (or skip-design)
                                                ▼
         designer agent (Claude Code GitHub Action) writes the technical spec + HTML mockup
         in design/, updates TECHNICAL-DECISIONS.md, opens a PR announced in Slack [design-review]
                                                │ review (@Claude in the Slack thread or @claude
                                                │ on the PR for changes), merge
                                                ▼
                                       issue ready-for-dev
                                                │ a person adds: implement
                                                ▼
         developer agent (Claude Code GitHub Action) builds the design in app/, updates the
         impacted existing features and their tests, updates the code map, opens a PR
                                                │ (test phase starts automatically)
                                                ▼
         tester agent: Playwright E2E tests per AC + full regression suite (desktop, mobile,
         accessibility) + exploration; report on the PR and in Slack     [in-test → test-review]
                                                │ a person adds: qa-approved (QA status ✓)
                                                ▼
                         review (@claude for changes), merge             [in-review]
                                                ▼
                                      issue done and closed
```

Concepts (human in the loop, living context, agents and skills, governance) and the flow:
[docs/aisdlc.md](docs/aisdlc.md) · Process: [docs/refinement-workflow.md](docs/refinement-workflow.md)

## Repository layout

```
.claude/
  agents/
    requirements-refiner.md           refines issues; preloads the five skills below
    impact-analyst.md                 research subagent for developers: returns a 1-page brief
    designer.md                       designs refined issues in design/: technical spec + HTML mockup
    developer.md                      implements approved issues and validated fixes in app/
    bug-investigator.md               finds a bug's root cause; never changes code
    tester.md                         tests code PRs: Playwright E2E + regression + report
  skills/
    impact-analysis/                  pick the specs an issue touches   (SKILL.md + output.schema.json)
    refine-kickoff/                   open a refinement                 (SKILL.md + output.schema.json)
    refine-thread/                    decide the next step              (SKILL.md + output.schema.json)
    requirement-format/               the final requirement format
    living-spec/                      spec format and update rules
    design-feature/                   read → decide → technical spec → mockup → summary → PR
    design-guidelines/                the rules every design follows (reuse, no new deps, a11y)
    technical-spec/                   design/issue-<n>/technical-spec.md format (AC → design)
    ui-mockup/                        self-contained HTML mockup on the real design tokens
    technical-summary/                keep design/TECHNICAL-DECISIONS.md (TD<n>) true
    implement-issue/                  read → plan → build → test → code map → PR
    tests-from-acceptance-criteria/   tests named after AC IDs (traceability)
    code-map/                         keep app/ARCHITECTURE.md true
    pr-description/                   the PR description reviewers rely on
    investigate-bug/                  reproduce → locate → classify → plan (no fix)
    root-cause-report/                the report a person validates
    fix-bug/                          regression test first, smallest validated fix, PR
    test-feature/                     read → plan → E2E tests per AC → regression → explore → report
    e2e-from-acceptance-criteria/     Playwright conventions: AC-named tests, roles, seeded storage
    regression-guard/                 what a failing existing test means and what may change
    exploratory-testing/              time-boxed browser session beyond the scripted tests
    test-report/                      the report a person approves with qa-approved
  designer-settings.json              designer agent permissions: design/ only
  developer-settings.json             developer agent permissions: app/ only
  tester-settings.json                tester agent permissions: app/e2e/ and its report only
  investigator-settings.json          investigator permissions: read and reproduce, no push
specs/                                living specs: one file per capability + generated indexes
design/                               TECHNICAL-DECISIONS.md (living summary of technical choices)
                                      + issue-<n>/technical-spec.md and mockup.html per design
app/                                  the Next.js static app + ARCHITECTURE.md (living code map)
config/refinement.yml                 settings, budgets, prompts and every posted text
automation/
  refinement/                         Python runner: GitHub ⇄ Slack ⇄ Claude ⇄ git plumbing only
  tests/                              offline tests of the whole loop
.github/workflows/                    refine-kickoff, refine-sync, design-agent, dev-agent, test-agent, bug-flow,
                                      claude (@claude), pr-merged, app-ci, tests
docs/                                 process, setup, Slack app manifest
```

**One source of instructions, two ways to use it.** The agents and skills are standard
Claude Code files:

- **The automation** loads the agent plus only the skills each step needs as Claude's system
  prompt (cached between runs), sends the issue, related specs and thread as data, and reads the
  answer through each skill's `output.schema.json`.
  Preview: `python -m automation.refinement show-prompt select|kickoff|thread`.
- **Developers** in Claude Code use the same files directly:
  - `/impact-analysis 4` or "use the impact-analyst agent on #4": what does #4 touch?
  - `/refine-kickoff 3`: draft the questions for issue #3
  - `/refine-thread 1`: where does the refinement of #1 stand?
  - `/design-feature 5` or "use the designer agent on #5": technical spec + mockup for #5
  - "read `specs/` and implement #2": the specs are the context for building

Change how Claude works by editing a skill; change wording, labels, channel, budgets or model
in `config/refinement.yml`. The Python code holds no instructions (a test enforces it).

## Context that scales
Agents never load all specs or issues: a compact generated index is searched in two stages
(modules, then specs), only a few specs are loaded within a character budget, and approved
requirements edit the existing capability specs instead of piling up new files.

## Automation
Labelling an issue `needs-refinement` starts the Slack thread within a minute; a sync job
every 10 minutes handles replies, the proposal and the approval; merging the spec PR marks the
issue ready. One-time setup: [docs/automation-setup.md](docs/automation-setup.md)

## Use it
1. Open an issue with the **Requirement** template (it adds `needs-refinement`).
2. Answer Claude's questions in the Slack thread ("3: yes", or "rest ok" for the defaults).
3. The PO approves the proposal: ✅ reaction, or reply "approved".
4. Review and merge the living spec PR announced in Slack; the issue becomes `ready-for-design`.
5. Add the `design` label: the designer agent opens a design PR (technical spec, HTML mockup,
   technical decisions), announced in Slack with a mockup link. Remarks? Mention @Claude in the
   Slack thread (or `@claude` on the PR) and the designer updates the same PR. Merge it; the issue
   becomes `ready-for-dev`. Small or non-UI change? Add `skip-design` instead.
6. Add the `implement` label: the developer agent builds it (and updates the existing features
   listed under "Impact on existing features") and opens a PR, announced in Slack.
7. The tester agent starts on its own: Playwright tests for every acceptance criterion, the whole
   regression suite on desktop and mobile with accessibility checks, a short exploration. Its
   report lands on the PR and in Slack. Add `qa-approved` to approve (add `test` to re-test).
8. Review it (comment `@claude …` for changes) and merge; the issue is done and closed.

**Bugs** take a shorter path: open a **Bug report** (it sets type Bug and the `bug` label), add `need-fix`. The
investigator posts a root-cause report on the issue and the status in Slack; add `fix-approved`
to validate it, and the developer agent opens the fix PR. Review, merge, done.

Tests: `pip install -r automation/requirements.txt && python -m automation.tests.test_refinement`
