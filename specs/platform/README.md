# platform

Capabilities in this module. Generated; do not edit by hand.

- [Agent tooling](agent-tooling.md) `platform/agent-tooling`: UI design skills and MCPs for the AI developer agent, chosen by Claude-user usage, plus a skill that searches and suggests more; a developer-workflow tool, not part of the app. (entities: ; decisions: 5; issues: #27)
- [App foundation](app-foundation.md) `platform/app-foundation`: Minimal static Next.js skeleton with a client-only localStorage helper, basic tooling and CI, deployed to Vercel on Node 26; no backend, no login. (entities: StorageResult; decisions: 13; issues: #7, #12)
- [App navigation](app-navigation.md) `platform/app-navigation`: A simple top or bottom nav with Today, Week and Habits on one page; switching views changes no URL path. (entities: ; decisions: 4; issues: #27)
- [Theme preference](theme-preference.md) `platform/theme-preference`: The user picks System, Light or Dark in the Habits view; System follows the device setting live, the choice is stored in theme:v1 and applied before first paint. (entities: ThemePreference; decisions: 8; issues: #41)
- [UI design system](ui-design-system.md) `platform/ui-design-system`: Minimal, neutral look with a light and a dark theme, built with CSS Modules and a design-token stylesheet, with the accessibility and responsive bar for every screen. (entities: ; decisions: 6; issues: #27, #41)
