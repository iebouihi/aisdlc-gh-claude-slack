---
id: platform/ui-design-system
title: UI design system
module: platform
summary: Minimal, neutral, light-only look built with CSS Modules and a design-token stylesheet, with the accessibility and responsive bar for every screen.
entities: []
status: active
issues: [27]
updated: 2026-11-01
---
# UI design system

## Current behaviour
- Colours, spacing and typography come from a design-token stylesheet, used by CSS Modules and the global stylesheet.
- Style is minimal: system font stack, neutral palette and one accent colour.
- Light theme only. Devices set to dark mode still get the light theme. There is no theme setting.
- Every screen (today list, habit management, Week overview) follows the same look. No new features or data come with the redesign.
- Bar for all screens: WCAG 2.1 AA contrast, visible focus, keyboard operable, usable from 320px with no horizontal scroll, no colour-only status.
- No Tailwind, UI library or new runtime dependency; only Next.js and React at runtime (see `platform/app-foundation` D3 and D11).
- Still a static export; supported browsers unchanged.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | CSS Modules plus a design-token stylesheet; no Tailwind, UI library or new runtime dependency. | #27 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793564182896619?thread_ts=1793564182.896619&cid=C0CDNGE90V7) |
| D2 | Style direction: minimal, system font, neutral palette, one accent colour. No mockup exists yet. | #27 | same thread |
| D3 | Light theme only; no dark mode and no theme setting. | #27 | same thread |
| D4 | Accessibility and responsive bar unchanged: AA contrast, visible focus, keyboard operable, 320px, no colour-only status. | #27 | same thread |
| D5 | UI acceptance is by the approver reviewing the Vercel preview. | #27 | same thread |

## Data
- Owns no stored data. No theme preference is stored.

## Not covered
- Dark mode and system theme preference.
- A mockup or brand identity.
- Any UI framework or component library.

## History
- 2026-11-01 #27: Created the capability (design tokens, minimal light style, accessibility bar).
