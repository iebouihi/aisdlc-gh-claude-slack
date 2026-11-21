---
name: ui-mockup
description: Build the HTML mockup of a feature's UI (design/issue-<n>/mockup.html) - one self-contained static page using the app's real design tokens, showing every state the acceptance criteria imply, at mobile and desktop widths. Use when a design has UI changes.
---

# UI mockup

The mockup lets a reviewer see the feature before it is built, and gives the developer the exact
layout, texts and states to implement. It is a picture in HTML, not a prototype of the app.

## File
`design/issue-<n>/mockup.html`: **one self-contained file**. No external CSS, JS, fonts, images
or CDNs (it is previewed straight from GitHub). No JavaScript, except a few lines if a state
can't be shown statically; prefer showing states side by side.

## Look: the app's own design system
- Copy the `:root` custom properties from `app/src/app/tokens.css` into a `<style>` block, as they
  are, and use only `var(--…)` for colours, spacing, radius, fonts and sizes. No other colour value.
- Reuse the app's existing patterns: read the relevant `*.module.css` and components (nav, list
  rows, forms, `.input`, dialogs, badges) and reproduce them; don't restyle what already exists.
- Mark what is new: a thin dashed accent outline (`outline: 2px dashed var(--accent)`) plus a
  small "New" tag around new or changed elements, so reviewers see the delta at a glance.

## Content
- A header: issue number and title, a one-line description, and a legend for the "New" marking.
- The screen in context: the existing view (nav, neighbouring sections) with the new parts in it.
- **One frame per state**, labelled with the state and the acceptance criteria it shows
  (`Empty · AC2`, `Invalid input · AC4`, `Success · AC1`). Include empty, normal, many items,
  error/invalid and any confirmation the requirement implies.
- Real texts: labels, buttons, messages and error texts exactly as the requirement states them.
- Two widths for each key frame: mobile (360px) and desktop (~960px), side by side or stacked.

## Accessibility in the markup
- Semantic HTML (`button`, `label` + `input`, headings in order, `role="alert"` for errors), so
  the mockup also documents roles and labels for the developer.
- Show the visible focus style on one focused control.
- Status is never colour alone: icon or text too, as in the app.

## Check before you commit
- Opens in a browser with no network requests; no horizontal scroll at 360px.
- Every state named in the technical spec's UI section is in the mockup, and vice versa.
