# AI-integrated SDLC: how this repo works

This repository is a working model of an AI-integrated software lifecycle, starting with the
**requirements phase** of a small product, *good-habit-tracker*. Agents do the drafting and
the bookkeeping; people make every decision. Four ideas carry the whole design.

---

## 1. Agents draft, humans decide (human in the loop)

Agents are fast at reading, structuring and writing; people own intent, trade-offs and
accountability. So every step has a clear owner, and every decision passes a human gate.

| Step | Agent does | Human does |
|---|---|---|
| Intake | | PO writes the issue and labels it `needs-refinement` |
| Impact analysis | finds the specs the issue touches | |
| Kick-off | restates the need, asks questions with proposed defaults | |
| Refinement | follows up on gaps and conflicts, tracks who decided what | team answers in Slack |
| Proposal | drafts the final requirement and the spec changes | |
| **Approval gate** | | **PO approves** (✅ or "approved") |
| Spec update | commits the spec changes, opens a pull request, announces it | |
| **Review gate** | | **team reviews and merges** the spec PR |
| Ready | marks the issue `ready-for-dev`, closes the loop in Slack | |

Rules that make the loop trustworthy:
- **Claude never invents a decision.** An answer counts only if a person gave it or explicitly
  accepted a proposed default, and the final requirement names who decided each point.
- **Approval is checked by code, not by the model.** Whether the approver reacted ✅ is a
  deterministic check; a model can't be talked into approving.
- **Nothing becomes truth without review.** The issue body changes only after approval; the
  living spec changes only through a merged pull request.
- **Agents act through narrow outputs.** In the automation, Claude answers through fixed tool
  schemas; the code does the posting, labelling and committing. Issue and Slack text are data,
  never instructions.

## 2. Living context

Agents are only as good as the context they get. Three kinds of context, each in its place:

| Context | Where | What it holds |
|---|---|---|
| **Current truth** | `specs/` | how the product works *today*: one file per capability, rules, decisions with stable IDs |
| **Change history** | GitHub issues and PRs | what was asked, when, and why it changed |
| **Reasoning** | Slack threads | the discussion behind each decision |

**Living** means the specs are kept true automatically: an approved requirement *edits* the
specs it touches (changed decisions are superseded, never left contradicting each other) and
the change is merged through review. The next agent, and the next developer, start from it.

**Scales to large repos.** Agents never load all specs or issues:
- generated indexes (`specs/README.md`, one per module) give a compact map;
- impact analysis picks modules first, then the few relevant specs, within character budgets;
- specs grow slowly, because requirements edit capabilities instead of adding files;
- each step loads only the skills it needs, and the stable part of the prompt is cached.

## 3. Agents and skills

Instructions are **files**, written once and used two ways.

- **Agent** (`.claude/agents/*.md`): *who* - role, principles, which skills it preloads.
  `requirements-refiner` runs the refinement; `impact-analyst` researches impact for developers.
- **Skill** (`.claude/skills/<name>/SKILL.md`): *how* - one task done well:
  `impact-analysis`, `refine-kickoff`, `refine-thread`, `requirement-format`, `living-spec`.
  A skill used by the automation also ships an `output.schema.json`: the structured answer.

| Used by | How |
|---|---|
| **Automation** (GitHub Actions) | loads the agent + the step's skills as Claude's system prompt, sends the issue, specs and thread as data, reads the answer through the skill's schema |
| **Developers** (Claude Code) | `/refine-kickoff 3`, `/impact-analysis 4`, "use the impact-analyst agent on #2", or just work in the repo with `CLAUDE.md` pointing to `specs/` |

Change *how* the agents work by editing a skill; both the automation and every developer get
the change on the next run.

## 4. Governance in Markdown files

Everything that steers an agent is a plain file in git, so it is versioned, reviewed in pull
requests, diffable and testable, like code.

| File | Governs |
|---|---|
| `CLAUDE.md` | project rules every Claude session follows |
| `.claude/agents/*.md` | roles and principles |
| `.claude/skills/*/SKILL.md` | methods, output formats, update rules |
| `config/refinement.yml` | channel, approver, labels, budgets, model, prompts, every posted text |
| `specs/**` | the product's current behaviour and decisions |
| `docs/refinement-workflow.md` | the process |

Guard rails that keep it honest:
- **No hidden instructions:** a test fails if sentence-length text appears in the Python code;
  prompts and messages must live in the files above.
- **Tests on every change** to agents, skills or config: the whole loop runs offline against
  the real files (22 scenarios: conflicts, change requests, approvals, spec updates, failures).
- **Traceability:** issue → Slack thread → decisions (who, where) → spec PR → merge.
- **Least privilege:** the automation's token can only touch issues, the spec branch and PRs.

---

## The requirement refinement phase

```mermaid
flowchart TD
    A["PO writes a GitHub issue<br/>label: needs-refinement"] --> B["Impact analysis<br/>agent picks related specs<br/>from the index"]
    B --> C["Kick-off<br/>agent restates the need and asks<br/>numbered questions with defaults<br/>label: in-refinement"]
    C --> D["Slack thread<br/>team answers"]
    D --> E{"Agent: all answered?<br/>conflicts with a spec?"}
    E -- "gaps or conflicts" --> F["Follow-up questions"]
    F --> D
    E -- "settled" --> G["Proposal<br/>final requirement +<br/>living spec changes"]
    G --> H{"PO approval<br/>checked by code"}
    H -- "changes requested" --> E
    H -- "approved" --> I["Spec branch + pull request<br/>announced in Slack<br/>issue body updated<br/>label: spec-review"]
    I --> J{"Team reviews<br/>the spec PR"}
    J -- "merged" --> K["specs/ updated for every agent<br/>label: ready-for-dev"]
    D -. "quiet for 3 days" .-> L["Nudge, then blocked"]
    L -. "reply" .-> D

    classDef human fill:#fde68a,stroke:#b45309,color:#1f2937
    classDef agent fill:#bfdbfe,stroke:#1d4ed8,color:#1f2937
    classDef truth fill:#bbf7d0,stroke:#15803d,color:#1f2937
    class A,D,H,J human
    class B,C,E,F,G,I,L agent
    class K truth
```

Yellow: people decide. Blue: agents and automation. Green: shared context updated.

## What comes next

The same pattern extends to every phase: an agent drafts from the living context, a person
approves, and the result updates the context for the next phase.

| Phase | Agent drafts | Human gate | Context updated |
|---|---|---|---|
| Requirements (this repo) | questions, final requirement, spec changes | approval + spec PR | `specs/` |
| Design | technical approach, data model changes | design review | `specs/`, decision log |
| Build | code and tests from the spec and acceptance criteria | code review | code, tests linked to AC IDs |
| Test | test cases from acceptance criteria, results | QA sign-off | coverage per AC |
| Release | release notes from merged specs and PRs | release approval | changelog |
