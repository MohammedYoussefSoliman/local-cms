# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Localization CMS**: centralized application copy so non-technical users can
create, translate, review, and publish content without a frontend deploy.
Client apps fetch published translations from a runtime API and feed them to
their existing i18n setup.

`docs/Localization-CMS-Initial-Architecture.md` is the source of truth for the
schema, the API surface, and the delivery phases. Read the relevant section
before designing anything — the numbered references throughout `.claude/rules/`
point back at it.

`docs/Backend-Delivery-Plan.md` sequences the remaining backend work as
tickets B1-B12 and records the decisions that closed six of the architecture
doc's §15 open items. Read it before starting any backend feature.

**Current phase: 1 (Foundation).** The workspace, database schema, auth, and
shared packages exist. Feature CRUD (Phase 2), the dashboard UI (Phase 3), and
the importer (Phase 4) do not yet.

## Package manager

**pnpm workspaces.** Always `pnpm` — never `npm` or `yarn` (`engine-strict` is
on and the engines field rejects them).

## Commands

```bash
pnpm install

# Database — required before the backend will boot
pnpm db:up                 # Postgres 16 in Docker
pnpm migration:run
pnpm seed                  # bootstrap locales (ar, en); idempotent

# Development
pnpm dev                   # backend + dashboard in parallel
pnpm dev:backend           # NestJS on :4050  (Swagger at /docs in dev)
pnpm dev:dashboard         # Vite on :4051

# Quality
pnpm lint / pnpm lint:fix
pnpm typecheck
pnpm test                  # every package that defines one
pnpm test:backend          # Jest
pnpm test:e2e              # needs a migrated database, runs in band

# Migrations
pnpm migration:generate libs/database/src/migrations/AddThing
pnpm migration:create   libs/database/src/migrations/AddThing   # hand-written
pnpm migration:run / pnpm migration:revert
```

### Running a single test

```bash
pnpm --filter=@cms/backend test -- auth.service            # Jest, by name
pnpm --filter=@cms/backend test -- -t 'revokes every session'
pnpm --filter=@cms/dashboard test -- src/modules/apps  # Vitest, by path
```

## Structure

```
apps/
  backend/        @cms/backend    NestJS 11 + TypeORM + Postgres
  dashboard/      @cms/dashboard  React 19 + Vite 6 + TanStack Query
libs/
  domain/         @cms/domain     domain types and invariant docs; no deps
  contracts/      @cms/contracts  HTTP payload/response types shared by both apps
  database/       @cms/database   entities, migrations, seeds, DataSource
  ui/             @cms/ui         shared dashboard components and helpers
  configs/        @cms/configs    shared tsconfig + jest preset
  linting/        @cms/linting    shared ESLint flat configs (node / react)
```

`libs/database` holds the entities rather than `apps/backend`, because the
migration CLI and the seeder need them without booting Nest.

## The one design decision everything else follows from

**Languages are rows, not columns, and not a TypeScript union.** Adding French
is an `INSERT` into `locales`. A per-language column (`ar`, `en`, `fr`) makes
every new language a migration; a `Record<'ar' | 'en', string>` makes it a
breaking type change.

The storage is normalized (`translation_values` = one row per entry × locale);
the runtime API response is nested JSON keyed by module slug then entry key.
Shaping one like the other is the mistake to watch for.

Full invariant list — module scope, append-only history, published-only reads,
optimistic locking, immutable slugs: `.claude/rules/cms-domain-invariants.md`.

## API architecture

- **Guards are global** (`app.module.ts`): `ThrottlerGuard` → `JwtAuthGuard` →
  `RolesGuard`, in that order. Every endpoint is protected by default; only
  login, refresh, and health carry `@Public()`. Never add
  `@UseGuards(JwtAuthGuard)` locally.
- **One response envelope.** `ResponseInterceptor` wraps success in
  `HTTPResponseType<T>`; `HttpExceptionFilter` produces `HTTPErrorResponse`
  and maps Postgres `23505` → 409 and `23514` → 422. Controllers return plain
  data.
- **Config is validated at boot** by Zod in `src/config/env.validation.ts`. A
  bad `JWT_ACCESS_SECRET` fails startup, not the first login. `process.env` is
  read only under `src/config/`.
- **Refresh tokens** are opaque random strings stored as SHA-256 hashes, and
  they rotate. Replaying a revoked token revokes every session for that user.
- **`synchronize` is never true.** The schema depends on partial unique
  indexes, CHECK constraints, and CITEXT that synchronize cannot express.

Naming: the domain's "module" (a translation namespace) collides with
`@Module()`. The entity is `TranslationModule`, its Nest module is
`TranslationModulesModule`, its table is `modules`.

## Dashboard architecture

Inherited wholesale from the frontend monorepo (`yamm-client-monorepo`), so
the conventions in `.claude/rules/global-*.md` apply as written:

- Feature modules under `src/modules/{Name}/` with `routes.tsx`, `pages/`,
  `services/`, `components/`, `locales/`.
- One `axiosInstance` (`@/config`) with token injection and a **serialized**
  refresh-and-retry queue — concurrent 401s must not each start their own
  refresh, because rotation would revoke the token the others are using.
- Query keys come from `src/helpers/queryKeys.ts`; mutations invalidate the
  key **root** only, from inside the hook.
- Access token lives in memory; only the refresh token and user are persisted
  (`partialize` in `store/auth-state.ts`).
- Arabic ships from day one: logical Tailwind utilities (`ms`/`me`, `ps`/`pe`,
  `start`/`end`) everywhere, `dir` set on `<html>` by `useLocale`.
- The translation editor renders **one column per enabled locale**, built from
  data. Never a hard-coded `ar`/`en` pair.

The dashboard's own UI strings come from bundled i18next files, not from the
CMS — bootstrapping the CMS UI from the CMS would make login unrenderable
whenever the API is down.

## Linting and formatting

**One ESLint config, at the repo root** (`eslint.config.mjs` →
`@cms/linting/workspace`), scoped by path glob. Do not add per-package
`eslint.config.*` files: ESLint 9 resolves its config from the **current
working directory**, not from the linted file, so a package-local config is
invisible to anything running from the root — lint-staged in the pre-commit
hook, CI, editor integrations. Package-local configs were the cause of a
pre-commit failure that `pnpm lint` could not reproduce.

`pnpm lint` / `pnpm lint:fix` run from the root over the whole workspace. To
lint one package: `pnpm exec eslint apps/backend/src`.

**Prettier does not format Markdown** (`.prettierignore`). The `.claude/`
rules and skills are prose with hand-aligned tables; reformatting them buries
the real edit in whitespace churn.

## Commit convention

Validated by commitlint. Types: `ci`, `chore`, `docs`, `ticket`, `feat`,
`fix`, `perf`, `refactor`, `revert`, `style`, `test`. Husky + lint-staged run
ESLint and Prettier pre-commit.

## Rules and skills

`.claude/rules/` is loaded by path glob. The API rules (`nestjs-*.md`,
`cms-domain-invariants.md`) are specific to this repo; the `global-*.md` rules
are inherited from the frontend monorepo and apply to the dashboard.

Skills worth knowing: `/new-nest-module`, `/new-migration`, `/new-module`
(dashboard), `/new-service-hook`, `/new-component`, `/new-test`, `/env-var`,
`/health-check`, `/review-pr`, `/create-pr`.

Agents: `audit-api-auth` (run before any PR touching `apps/backend`),
`audit-hooks`, `audit-module`, `audit-i18n`, `test-gaps`, `find-pattern`.

## Open decisions (architecture doc §15)

Still unresolved — ask rather than assuming: editor scoping (per app, per
module, or both); whether publishing requires review approval; plain text vs.
ICU MessageFormat; per-value publish vs. versioned bundle releases; CDN and
cache-invalidation strategy.

Resolved since the doc was written: **ORM is TypeORM**, and shared packages
live in **`libs/`** (the doc's §12 diagram says `packages/`; §1 says `libs/`,
which is what matches the frontend monorepo).
