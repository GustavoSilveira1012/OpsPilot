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
pnpm db:up
pnpm --filter @opspilot/api db:migrate:dev --name ops002_initial_schema
```

Docker Desktop is required for the local PostgreSQL service. The committed local credentials are for local development only. Use secrets from the deployment environment for hosted databases.

## Start and validate

```powershell
pnpm dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:3001`. Visit `http://localhost:3001/api/v1/health` to inspect the API health contract.

Database commands:

```powershell
pnpm db:up
pnpm db:validate
pnpm db:generate
pnpm --filter @opspilot/api db:migrate:dev --name describe_change
pnpm db:migrate:deploy
pnpm db:down
```

Use `migrate dev` only against a local development database. CI and deployed environments should use `migrate deploy`, which applies committed migrations without resetting data.

Before submitting changes, run:

```powershell
pnpm format:check
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm build
```

## Environment variables

For Supabase Auth configuration, confirmation URLs, organization endpoint contracts, and security verification, see [OPS-003](ops-003.md). Configure both applications with the same Supabase project URL and publishable key. The API requires `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`; the web requires their `NEXT_PUBLIC_` equivalents. These values must be supplied before starting the API or building the web app for deployment.

| App | Variable                   | Purpose                                                              |
| --- | -------------------------- | -------------------------------------------------------------------- |
| API | `PORT`                     | HTTP listen port, default `3001`                                     |
| API | `CORS_ORIGINS`             | Comma-separated, exact browser origins allowed to call the API       |
| API | `APP_VERSION`              | Version returned from the health endpoint                            |
| API | `DATABASE_URL`             | Runtime PostgreSQL URL; use a pooled URL for Supabase in deployment  |
| API | `DIRECT_URL`               | Direct PostgreSQL URL used by Prisma CLI and migrations              |
| Web | `NEXT_PUBLIC_API_BASE_URL` | Browser-visible API base URL, default `http://localhost:3001/api/v1` |

Never place secrets in `NEXT_PUBLIC_*`; Next.js includes those values in client bundles. Never commit real database credentials.
