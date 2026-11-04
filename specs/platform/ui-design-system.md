---
id: platform/ui-design-system
title: UI design system
module: platform
summary: Minimal, neutral look with a light and a dark theme, built with CSS Modules and a design-token stylesheet, with the accessibility and responsive bar for every screen.
entities: []
status: active
issues: [27, 41]
updated: 2026-11-04
---
# UI design system

## Current behaviour
- Colours, spacing and typography come from a design-token stylesheet, used by CSS Modules and the global stylesheet. The tokens have light and dark values.
- Style is minimal: system font stack, neutral palette and one accent colour, in both themes.
- Two themes: light and dark. Which one is shown is decided by `platform/theme-preference` (System by default, or the user's choice).
- Dark mode covers every screen (today list, habit management, Week overview), the nav, forms, badges and error messages. No new features or data come with it.
- Every screen follows the same look. No new features or data come with the redesign.
- Bar for all screens, in both themes: WCAG 2.1 AA contrast, visible focus, keyboard operable, usable from 320px with no horizontal scroll, no colour-only status.
- No Tailwind, UI library or new runtime dependency; only Next.js and React at runtime (see `platform/app-foundation` D3 and D11).
- Still a static export; supported browsers unchanged.

## Decisions
| ID | Decision | Since | Source |
|---|---|---|---|
| D1 | CSS Modules plus a design-token stylesheet; no Tailwind, UI library or new runtime dependency. | #27 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793564182896619?thread_ts=1793564182.896619&cid=C0CDNGE90V7) |
| D2 | Style direction: minimal, system font, neutral palette, one accent colour. No mockup exists yet. | #27 | same thread |
| ~~D3~~ | ~~Light theme only; no dark mode and no theme setting.~~ → superseded by D6 (#41) | #27 | same thread |
| D4 | Accessibility and responsive bar unchanged: AA contrast, visible focus, keyboard operable, 320px, no colour-only status. | #27 | same thread |
| D5 | UI acceptance is by the approver reviewing the Vercel preview. | #27 | same thread |
| D6 | The app supports a light and a dark theme. Dark values are added to the design tokens, keeping the neutral palette and one accent colour. No mockup; the approver reviews the Vercel preview (D5). | #41 | [Slack thread](https://aisdlc-group.slack.com/archives/C0CDNGE90V7/p1793804167913529?thread_ts=1793804167.913529&cid=C0CDNGE90V7) |
| D7 | The accessibility and responsive bar (D4) applies in both themes. | #41 | same thread |

## Data
- Owns no stored data. The theme choice is stored by `platform/theme-preference`.

## Not covered
- Scheduled auto dark and more than two themes.
- A mockup or brand identity.
- Any UI framework or component library.

## History
- 2026-11-01 #27: Created the capability (design tokens, minimal light style, accessibility bar).
- 2026-11-04 #41: Added a dark theme with dark token values (D6, D7); superseded D3.
