---
name: design-guidelines
description: The rules every technical design and UI mockup for good-habit-tracker follows - constraints from the specs and code map, reuse before invention, decision hygiene, UX and accessibility bar. Use when designing a feature or reviewing a design.
---

# Design guidelines

## Hard constraints (never designed around)
- **The approved requirement and the living specs win.** A design never changes behaviour; it
  decides how to build the behaviour that was approved. A spec decision that blocks a good design
  is an open question for the reviewer, not something to work around.
- **The product's architecture holds** (`app/ARCHITECTURE.md`): static export, no backend, no
  login, data only in the browser; domain logic pure in `src/lib/`, storage behind the one adapter
  with versioned keys; React state and small hooks, no state library.
- **No new runtime dependency.** Only `next`, `react`, `react-dom`. A design that truly needs one
  says why in an open question; it is never assumed.
- **Honour every technical decision** in `design/TECHNICAL-DECISIONS.md` and every `A<n>` in the
  code map. Changing one is allowed only by superseding it explicitly (see `technical-summary`)
  and calling it out in the PR.

## Reuse before invention
1. An existing module, function or component that can be extended.
2. An existing convention from the code map (computed-not-stored, `pendingFocus`, in-page views,
   tokens only, hand-written modals…).
3. Only then something new, placed where the code map says that kind of thing lives.

## Data and state
- Prefer **computed, never stored** values. Store only what the user enters or earns.
- New stored data: name the key (`<name>:v<n>`) or the optional field added to an existing entry,
  how old data without it is read, and what counts as corrupted.
- Say which component owns each piece of state, and whether it survives a view switch or reload.

## UI and UX
- Every screen element comes from the design tokens (`app/src/app/tokens.css`) and existing
  patterns; no new colours, fonts or sizes outside the tokens.
- Accessibility bar (`platform/ui-design-system`): labelled controls, keyboard operation, visible
  focus, errors announced, AA contrast, no colour-only status, usable from 320px.
- Design every state the requirement implies: empty, normal, many items, error/invalid input,
  and the success feedback. Keep texts as they will appear (the real labels and messages).

## Decision hygiene
- Make a `TD<n>` only for a choice later work must respect. Record the reason in one line.
- Prefer reversible choices; name the trade-off when one isn't.
- Design for the acceptance criteria and nothing more: no speculative extension points.

## Size
- Technical spec: what a developer needs and no more (aim for under ~150 lines).
- Mockup: one page; show states side by side rather than building navigation.
