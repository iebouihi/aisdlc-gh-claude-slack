# Requirement Refinement Workflow (GitHub ⇄ Claude ⇄ Slack ⇄ living specs)

How a rough requirement for **good-habit-tracker** becomes an approved, testable one, and how
the product's shared context (`specs/`) stays true as requirements are approved.

| What | Where |
|---|---|
| Who Claude is, its principles | `.claude/agents/requirements-refiner.md` |
| Impact research for developers | `.claude/agents/impact-analyst.md` |
| Find the specs an issue touches | `.claude/skills/impact-analysis/` |
| Open a refinement | `.claude/skills/refine-kickoff/` |
| Decide the next step in a thread | `.claude/skills/refine-thread/` |
| Final requirement format | `.claude/skills/requirement-format/` |
| Living spec format and update rules | `.claude/skills/living-spec/` |
| How the product works today | `specs/` (one file per capability, generated indexes) |
| Channel, approver, labels, budgets, model, prompts, all posted texts | `config/refinement.yml` |
| Plumbing between GitHub, Slack, Claude and git | `automation/refinement/` |

## Two kinds of context
- **Issues** are change requests and their history (discussion, status). There can be thousands.
- **Living specs** describe current behaviour, one file per capability, with stable decision IDs.
  They grow slowly, because an approved requirement *edits* the specs it touches.
  Agents read specs, not the pile of issues.

## States (GitHub labels)

```
needs-refinement ──► in-refinement ──► spec-review ──► ready-for-dev
                          │            (spec PR open)   (spec PR merged)
                          └──► blocked
```

An issue with no lasting decision to record goes from `in-refinement` straight to `ready-for-dev`.

## Steps
1. **Intake.** The PO opens an issue with the *Requirement* template (adds `needs-refinement`).
2. **Impact analysis** (`impact-analysis`). Claude picks the few related specs from a compact index.
   With many specs it picks modules first, then specs inside them. Nothing else is loaded.
3. **Kick-off** (`refine-kickoff`). Claude restates the issue, builds on existing decisions, and asks
   explicitly about any decision the issue would change. The thread shows which specs it builds on.
4. **Refinement** (`refine-thread`, every 10 min). Follow-ups on gaps and conflicts, with the
   related specs re-read fresh each time. Changing an existing decision needs an explicit yes.
5. **Proposal.** The final requirement plus the living spec changes: new spec files and edits
   to existing ones (changed decisions superseded, never contradicted), listed in the Slack message.
6. **Approval.** Only the approver: ✅ on the proposal, or a reply that is only an approval.
   Checked by the automation, never decided by Claude.
7. **Write-back + spec PR.** The issue body becomes the final requirement; the spec changes and
   regenerated indexes are committed on `spec/issue-<n>` and a pull request is opened and
   announced in Slack (thread and channel) as a living spec update. Label: `spec-review`.
8. **Merge → ready.** Merging the spec PR marks the issue `ready-for-dev` and tells the thread.
   From then on, every agent sees the new behaviour in `specs/`.
9. **Nudge / blocked.** A quiet thread gets a nudge, then `blocked`; a new reply resumes it.

## Keeping context small (scales to large repos)
- Two-stage selection (modules, then specs) over generated indexes, never the whole tree.
- Budgets in config: `specs.max_specs`, `specs.context_chars`, `specs.index_chars`.
- Each step loads only its skills (`claude.steps`), and the system prompt is cached between runs.
- The specs chosen at kick-off are remembered on the issue, so later steps don't select again.
- Approval, merge, nudges and labels never call Claude.

## Rules
- Specs = current truth; issues = change history; Slack = the reasoning.
- The issue body changes only after approval; specs change only through a reviewed PR.
- Claude never invents decisions; every decision names who made it and where.
