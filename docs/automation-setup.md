# Automation setup

Two GitHub Actions run the refinement workflow without anyone prompting Claude:

| Workflow | When | What |
|---|---|---|
| `refine-kickoff.yml` | An issue gets `needs-refinement` | Claude reads it, opens a thread in `#claude-app` with questions, labels it `in-refinement` |
| `refine-sync.yml` | Every 10 min (or *Run workflow*) | Claude reads new replies: asks follow-ups, posts the 📋 proposal, writes back after the approver's ✅, nudges / marks `blocked` |

Claude's instructions: `.claude/agents/requirements-refiner.md` and its skills in `.claude/skills/`.
Settings and texts: `config/refinement.yml`. Plumbing: `automation/refinement/`.

## One-time setup (≈10 minutes)

### 1. Slack app (Claude's own bot identity)
1. Go to <https://api.slack.com/apps> → **Create New App** → **From a manifest** → pick your workspace.
2. Paste `docs/slack-app-manifest.yml` → **Create** → **Install to Workspace** → **Allow**.
3. Copy the **Bot User OAuth Token** (`xoxb-…`) from *OAuth & Permissions*.
4. In Slack, in `#claude-app`, type `/invite @Claude`.

### 2. GitHub secrets
Repo → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | A key from <https://console.anthropic.com> |
| `SLACK_BOT_TOKEN` | The `xoxb-…` token from step 1 |

### 3. Settings
Channel, approver, model, labels and all texts are in `config/refinement.yml`: edit and push.
To override one without a commit, add a repo **variable** with the same effect:

| Variable | Overrides in `config/refinement.yml` |
|---|---|
| `SLACK_CHANNEL_ID` | `slack.channel_id` |
| `SLACK_APPROVER_ID` | `slack.approver_id` |
| `CLAUDE_MODEL` | `claude.model` |

Until the secrets exist, both workflows exit with a warning and do nothing.

## Check it works
1. Open a new issue with the **Requirement** template (it adds `needs-refinement`).
2. Within a minute, Claude posts the kick-off in `#claude-app` and the issue turns `in-refinement`.
3. Reply in the thread. Within 10 minutes Claude follows up or posts the 📋 proposal
   (or go to **Actions → Refinement sync → Run workflow** to skip the wait).
4. As the approver, react ✅ or reply "approved" → after the next sync the issue body is
   rewritten and labelled `ready-for-dev`.
