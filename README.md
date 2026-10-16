# OpsPilot

OpsPilot is a full-stack engineering project for helping enterprise teams coordinate software incidents, ownership, updates, and follow-up work. Sprint 1 tasks OPS-001 and OPS-002 establish the monorepo and PostgreSQL foundations; product workflows will be added in later tasks.

## Repository layout

```text
apps/
  api/                 NestJS REST API
  web/                 Next.js App Router frontend
packages/
  contracts/           Shared API response types
  eslint-config/       Shared ESLint flat configs
  typescript-config/   Shared TypeScript compiler configs
infra/                 Infrastructure decisions and future deployment assets
docs/                  Architecture and contributor guidance
.github/workflows/     CI
```

## Prerequisites

- Node.js 24.22.0 (the current LTS baseline), or Node 22.22.3+ for local development.
- pnpm 12.14.0, selected through the root `packageManager` field.
- Git for version control and GitHub Actions.

The runtime and pnpm version are pinned in `.nvmrc` and `package.json`. The workspace catalog centralizes compatible version ranges; `pnpm-lock.yaml` records the exact resolved package versions.

Resolved versions in this lockfile:

| Area                | Versions                                                  |
| ------------------- | --------------------------------------------------------- |
| Runtime and tooling | Node.js 24.22.0, pnpm 12.14.0, Turborepo 2.11.8           |
| Web                 | Next.js 16.4.2, React 19.3.1                              |
| API                 | NestJS 12.1.3, Nest CLI 12.0.8                            |
| Database            | PostgreSQL 18.6, Prisma ORM 7.10.0, node-postgres 8.23.1  |
| Type and lint       | TypeScript 6.0.3, ESLint 9.39.5, typescript-eslint 8.71.2 |

ESLint stays on 9.39.5 because the React and import plugins in the current Next.js lint config do not yet declare ESLint 10 support. The workspace peer check passes with this combination.

## Windows PowerShell setup

From the repository root:

```powershell
if (-not (Test-Path .git)) { git init -b main }
node --version
npm install --global corepack@latest
corepack enable pnpm
corepack install --global pnpm@12.14.0
pnpm --version
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm install --frozen-lockfile
```

## PostgreSQL and Prisma

The local PostgreSQL service uses Docker Compose. Copy the API environment example as shown above, then apply the initial migration:

```powershell
pnpm db:up
pnpm --filter @opspilot/api db:migrate:dev --name ops002_initial_schema
```

The API uses Prisma ORM 7.10.0 with the PostgreSQL driver adapter. For local development, `DATABASE_URL` and `DIRECT_URL` point to the local container. For hosted PostgreSQL, use a pooled `DATABASE_URL` for API traffic and a direct `DIRECT_URL` for Prisma migrations.

The schema stores the Supabase Auth UUID as `users.id`; passwords and provider credentials remain in Supabase Auth. Tenant relations carry `organizationId` through composite foreign keys.

Stop the local database with `pnpm db:down`; its named volume keeps local data.

Start both applications:

```powershell
pnpm dev
```

Open the frontend at `http://localhost:3000`. The API health endpoint is `http://localhost:3001/api/v1/health`.

## Validation

Run these before opening a pull request:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

The GitHub Actions workflow runs the same quality gates on pushes and pull requests.

## Environment

Copy the examples above for local use. Do not commit `.env` or `.env.local` files. The frontend variable is public and may be embedded in browser output; never put secrets in `NEXT_PUBLIC_*` values.

See [docs/development.md](docs/development.md), [docs/architecture.md](docs/architecture.md), [docs/ops-001.md](docs/ops-001.md), and [docs/ops-002.md](docs/ops-002.md).
