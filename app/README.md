# good-habit-tracker (app)

A static Next.js app (App Router, TypeScript). No backend, no login: **static, localStorage only**.
All data stays in the browser's `localStorage`; there are no API routes or server code.

Requires Node 26 (`nvm use` reads `.nvmrc`; `engines.node` is `26.x`). Supported browsers: the latest two versions of
Chrome, Firefox, Safari and Edge.

## Deployment

Vercel deploys the app with default settings (root directory `app/`, Next.js preset, npm, static
export). Production is deployed from `main`, and each pull request gets a preview URL. Hosting
does not change where data lives: it stays in the browser's `localStorage`.

## Run, test, build

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint         # ESLint (Next.js config)
npm run typecheck    # tsc --noEmit
npm test             # Vitest
npm run build        # static export to out/
npm run check        # lint + typecheck + test + build
npm run format       # Prettier
```

## Folder layout

| Path              | What lives there                                                    |
| ----------------- | ------------------------------------------------------------------- |
| `src/app/`        | routes, root layout, global stylesheet and CSS Modules              |
| `src/components/` | UI components with colocated tests                                  |
| `src/lib/`        | domain logic and the storage helper (`storage.ts`, key `habits:v1`) |

Components never touch `localStorage` directly; they use the helper in `src/lib/storage.ts`, which
never throws and returns a failure result instead.
