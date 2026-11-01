---
id: platform/agent-tooling
title: Agent tooling
module: platform
summary: UI design skills and MCPs for the AI developer agent, chosen by Claude-user usage, plus a skill that searches and suggests more; a developer-workflow tool, not part of the app.
entities: []
status: active
issues: [27]
updated: 2026-11-01
---
# Agent tooling

## Current behaviour
- The repo's agent config lists UI design skills and a short list of MCPs for the AI developer agent.
- The initial skills and MCPs were chosen by a search for those most used by Claude users. The docs (README or docs) record, for each, its source and the search date.
- One skill searches and suggests more skills and MCPs on request, ranked by how widely they are used by Claude users. Each suggestion has a name, purpose and source link.
- The tooling is a developer-workflow tool. It is not shipped in the app, adds no runtime dependency and needs no app code changes.
- No API key or secret is committed.
- Acceptance: the approver reviews the chosen skills/MCPs in the PR; a developer runs the UI design skill on one screen to check it works.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | Agent tooling lives in the repo's agent config and docs; it is not part of the app and adds no runtime dependency. | #27 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793564182896619?thread_ts=1793564182.896619&cid=C0CDNGE90V7) |
| D2 | UI design skills and a short list of MCPs are added and documented. | #27 | same thread |
| D3 | The initial skills and MCPs are chosen by a search for those most used by Claude users; source and search date are recorded in the docs. | #27 | same thread |
| D4 | One skill searches and suggests more skills/MCPs on request, ranked by usage among Claude users. | #27 | same thread |
| D5 | Acceptance: approver reviews the chosen skills/MCPs in the PR; a developer runs the UI design skill on one screen. | #27 | same thread |

## Data
- Owns no app data. Skills and MCP entries live in the repo's agent config; sources and search dates in the docs.

## Not covered
- Any AI feature inside the app.
- A single official ranking of "most used"; the sources are named in the docs and judged by the approver.
- Handling of MCP keys beyond not committing them.

## History
- 2026-11-01 #27: Created the capability (UI design skills, MCP list chosen by Claude-user usage, search-and-suggest skill).
