# Architecture overview

## Product boundary

OpsPilot is an incident coordination platform for engineering teams. The first release is centered on incidents, responders, timeline updates, service ownership, and follow-up actions. OPS-001 establishes delivery tooling, OPS-002 adds the persistence schema, and OPS-003 adds Supabase authentication and organization onboarding.

## Runtime components

- `apps/web` is the Next.js App Router frontend. It owns browser rendering and user interactions.
- `apps/api` is the NestJS REST API. Its versioned routes live under `/api/v1`.
- `packages/contracts` contains small, framework-independent TypeScript contracts shared between the API and web app.
- `packages/typescript-config` and `packages/eslint-config` keep compiler and lint policy consistent.
- `infra` is reserved for deployment and infrastructure-as-code decisions.

The dependency direction is apps → shared packages. Shared packages must not import from applications. The web app calls the API over HTTP and uses Supabase only for Auth; it does not connect directly to the application database.

The identity/authorization decision is recorded in [ADR 0001](adr/0001-identity-and-authorization.md): Supabase owns identity, NestJS owns access decisions, and the OPS-002 Prisma schema owns application records.

## Initial API contract

`GET /api/v1/health` is a public liveness endpoint returning `HealthResponse` from `@opspilot/contracts`. Startup validates Auth configuration and connects Prisma; the liveness handler itself does not query the database. Organization API contracts and authorization behavior are documented in [OPS-003](ops-003.md).

## Operational decisions

- The supported local baseline is Node 22.22.3 or Node 24.15+; CI uses the pinned Node 24 LTS release in `.nvmrc`.
- pnpm workspaces link internal packages. Turborepo builds dependency packages before consumers.
- Secrets are supplied through deployment environment variables. Only `.env.example` files are committed.
- The API allows browser requests only from the explicit `CORS_ORIGINS` allowlist.

## Persistence boundary

- PostgreSQL is the system of record for OpsPilot application data.
- Prisma ORM 7.10 uses `@prisma/adapter-pg`; `prisma.config.ts` supplies a direct URL to CLI operations while the API client reads `DATABASE_URL`.
- `User.id` is the UUID issued by Supabase Auth. Passwords and provider tokens are owned by Supabase Auth and are not stored in the application schema.
- Organization-scoped records include `organizationId`. Composite foreign keys keep service ownership, incident responder assignments, incidents, and timeline events within one organization.
- Memberships and services are soft-deactivated or archived so historical incident records keep their ownership context.
- The initial schema covers users, organizations, memberships, services, incidents, active responder assignments, and incident timeline events. A global NestJS guard verifies Supabase tokens; organization reads require ACTIVE membership and exclude archived/deactivated records. RLS blocks direct browser Data API access to application tables.
