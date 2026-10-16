# Infrastructure

## Local development

The root `compose.yaml` provides a PostgreSQL 18.6 development database with a named data volume. Start it from the repository root with `pnpm db:up`.

The local container credentials are examples for a developer workstation. Do not reuse them in staging or production.

## Hosted PostgreSQL

Use a pooled connection string for API runtime traffic and a direct connection string for Prisma migrations:

- `DATABASE_URL`: pooled host, suitable for the Node.js adapter.
- `DIRECT_URL`: direct PostgreSQL host for `prisma migrate deploy`.

Keep both values in environment or secret management; never commit production connection strings.
