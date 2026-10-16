# Development guide

## First-time setup on Windows

Run these commands in PowerShell from the repository root:

```powershell
npm install --global corepack@latest
corepack enable pnpm
corepack install --global pnpm@12.14.0
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm install
```

The root `packageManager` field pins pnpm. The lockfile should be committed after `pnpm install` succeeds.

## Start and validate

```powershell
pnpm dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:3001`. Visit `http://localhost:3001/api/v1/health` to inspect the API health contract.

Before submitting changes, run:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

## Environment variables

| App | Variable                   | Purpose                                                              |
| --- | -------------------------- | -------------------------------------------------------------------- |
| API | `PORT`                     | HTTP listen port, default `3001`                                     |
| API | `CORS_ORIGINS`             | Comma-separated, exact browser origins allowed to call the API       |
| API | `APP_VERSION`              | Version returned from the health endpoint                            |
| Web | `NEXT_PUBLIC_API_BASE_URL` | Browser-visible API base URL, default `http://localhost:3001/api/v1` |

Never place secrets in `NEXT_PUBLIC_*`; Next.js includes those values in client bundles.
