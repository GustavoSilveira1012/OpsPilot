# Architecture overview

## Product boundary

OpsPilot is an incident coordination platform for engineering teams. The first release is centered on incidents, responders, timeline updates, service ownership, and follow-up actions. OPS-001 builds the delivery foundation and health check only; it does not persist incident data yet.

## Runtime components

- `apps/web` is the Next.js App Router frontend. It owns browser rendering and user interactions.
- `apps/api` is the NestJS REST API. Its versioned routes live under `/api/v1`.
- `packages/contracts` contains small, framework-independent TypeScript contracts shared between the API and web app.
- `packages/typescript-config` and `packages/eslint-config` keep compiler and lint policy consistent.
- `infra` is reserved for deployment and infrastructure-as-code decisions.

The dependency direction is apps → shared packages. Shared packages must not import from applications. The web app calls the API over HTTP; it does not connect directly to the eventual database.

## Initial API contract

`GET /api/v1/health` returns `HealthResponse` from `@opspilot/contracts` with service status, service name, app version, and a UTC timestamp. The health check is intentionally independent of a database until persistence is introduced.

## Operational decisions

- The supported local baseline is Node 22.22.3 or Node 24.15+; CI uses the pinned Node 24 LTS release in `.nvmrc`.
- pnpm workspaces link internal packages. Turborepo builds dependency packages before consumers.
- Secrets are supplied through deployment environment variables. Only `.env.example` files are committed.
- The API allows browser requests only from the explicit `CORS_ORIGINS` allowlist.
