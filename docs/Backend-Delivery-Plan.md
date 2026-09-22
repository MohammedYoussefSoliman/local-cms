# Backend Delivery Plan

How the Localization CMS backend gets from "Phase 1 foundation" to a working
Phase 2 API plus the Phase 4 importer, one ticket at a time.

`docs/Localization-CMS-Initial-Architecture.md` remains the source of truth for
the schema and the API surface. This document sequences the work and records
the decisions that §15 left open. The dashboard gets a separate plan — it needs
design first.

**Scope:** `apps/backend`, `libs/database`, `libs/domain`, `libs/contracts`,
`libs/importer`. Nothing here touches `apps/dashboard`.

---

## Where the code actually is

Phase 1 is genuinely finished, and further along than a phase-1 usually is:

- All nine tables exist, with the CHECK constraints and partial unique indexes
  that carry the invariants. One migration, hand-written.
- JWT auth works end to end — rotating hashed refresh tokens, replay detection,
  issuer/audience validation, per-request user re-read.
- The global guard stack, the response envelope, the exception filter with its
  Postgres `23505 → 409` / `23514 → 422` mapping, and the Zod-validated env
  are all in place.
- `libs/domain` and `libs/contracts` already declare most of the types the
  Phase 2 endpoints will return.

What is missing is the product:

| Gap | Consequence |
|---|---|
| `src/modules/` has only `auth`, `health`, and a controller-less `users` | Five of the nine tables have no code touching them |
| `@Roles()` is defined, used on zero endpoints | `RolesGuard` is registered but never exercised |
| `enableVersioning()` is on, no `@Version()` anywhere | The doc's `/v1/...` runtime surface does not exist |
| No user seed | There is no way to create the first user, so login cannot be exercised at all |
| One spec total, no e2e, no CI | Nothing guards the invariants above |

---

## Decisions

These close six of the open items in architecture doc §15. Each is recorded
here rather than in §15 so the original document stays a record of what was
proposed, and this one of what was chosen.

| Question (§15) | Decision | Why |
|---|---|---|
| Review requirement | **Direct publish.** `admin` and `editor` may both publish. `in_review` stays in the enum and is settable, but nothing blocks on it | Simplest correct MVP; adding an approval gate later is a guard change, not a schema change |
| Editor scoping | **Role-only**, behind one `assertCanEditApp(user, appId)` hook | Per-app assignment becomes one table plus one method body, instead of a sweep through every service |
| Runtime auth | **`api_keys` table + `X-API-Key`**, scoped per app | `nestjs-auth.md` Rule 2 caps `@Public()` at three routes and names the runtime endpoints as explicitly not an exception |
| Release model | **Derived `releaseId`** — `sha256(max(published_at) + ':' + count)`, truncated | Publishing invalidates the ETag immediately, with no `releases` table and no cut-a-release step |
| Message format | **ICU parsed and validated on write**, `rich_text` sanitized, 422 on malformed | `@cms/domain` already says ICU "must be validated before it is published"; the alternative is discovering it at render time in production |
| Global override rules | Global modules resolve **under** app modules, per `RESOLUTION_ORDER`. No per-app enable/disable of individual global modules in MVP | Matches the documented resolution chain; per-app global toggles can be added without touching stored data |

Still open, and still worth asking before assuming: hosting/CDN and
cache-invalidation strategy, and expected volumes (§15).

### One consequence of the schema, stated up front

`translation_values` holds **one row per (entry, locale)** with a single
`status`. There is nowhere to park a draft alongside a live published value.

So: **editing an already-published value keeps it published and goes live
immediately.** Only never-published values sit in `draft`.

The alternative — demoting to `draft` on edit — makes the key disappear from
the live runtime bundle until someone republishes, which is a content
regression on a running storefront. Since direct publish is the chosen
workflow, the same person could publish the edit anyway, so nothing is being
bypassed.

Every edit still writes a history row, so rollback works either way. When
review-before-publish lands, the upgrade path is a second row per (entry,
locale) or a `draft_value` column — recorded here so it is not rediscovered
as a surprise.

### Migrations

**One new migration in this entire plan:** `AddApiKeys` (B7). The Phase 1
schema already covers everything else. If a ticket seems to need a schema
change, re-read `.claude/rules/cms-domain-invariants.md` first — particularly
Rule 1, since "support French" is an `INSERT`, not a migration.

---

## Sequence

```
B1 ─┬─ B2 ── B3 ─┬─ B4 ── B5 ── B6 ─┬─ B8 ── B10
    │            │                  └─ B11
    │            └─ B7 ─────────────┘
    └─ B9

B12 last
```

B9 can be picked up any time after B1. Everything else is linear along the
arrows.

### New dependencies

| Package | Where | For |
|---|---|---|
| `@formatjs/icu-messageformat-parser` | `apps/backend` | B6 — parse `icu_message` values |
| `sanitize-html` + `@types/sanitize-html` | `apps/backend` | B6 — `rich_text` allowlist |
| `argon2` | `libs/database` | B1 — hash the bootstrap admin password |
| `fast-glob` | `libs/importer` | B11 — locale-file discovery |

### Conventions every ticket follows

From `.claude/rules/`, not restated per ticket:

- Files per feature: `{feature}.module.ts`, `.controller.ts`, `.service.ts`,
  `.service.spec.ts`, `dto/`. Scaffold with `/new-nest-module`.
- Controllers are thin; services never import HTTP types; return plain data,
  never the envelope.
- Every mutating route carries an explicit `@Roles()` or a `// no-role:`
  comment explaining the deliberate absence.
- `ParseUUIDPipe` on every id param — without it a malformed id reaches
  Postgres and returns 500 instead of 400.
- Payload types go in `libs/contracts`; the DTO class `implements` the payload
  type so drift is a compile error. `libs/contracts` stays free of
  `class-validator` so the browser bundle does not pull decorators.
- List endpoints extend `PaginationQueryDto` from `@/common`. Never `find()` a
  table that grows without bound.
- The service spec lands in the same commit, and tests a **domain invariant**
  the feature owns — not that `repo.save` was called.
- Run the `audit-api-auth` agent before opening the PR.

---

## B1 — Bootstrap the missing plumbing

*No dependencies. Everything else builds on this.*

**Goal:** make the app runnable end to end and put CI in front of every later
ticket.

**Work**

1. **URI versioning.** `apps/backend/src/main.ts`:
   `enableVersioning({ type: VersioningType.URI, defaultVersion: VERSION_NEUTRAL })`.
   CMS endpoints stay at `/api/...`; only the runtime controller (B8) carries
   `@Version('1')`, landing at `/api/v1/apps/...`. Today versioning is enabled
   with no default and no `@Version()` anywhere, which means it does nothing.

2. **Bootstrap admin seed.** `libs/database/src/seeds/seed-admin.ts` —
   idempotent, argon2, reads `BOOTSTRAP_ADMIN_EMAIL` and
   `BOOTSTRAP_ADMIN_PASSWORD`, creates one `admin` with status `active`.
   Register it in `run-seeds.ts` next to `seedLocales`. Add `argon2` to
   `libs/database` dependencies. **Without this there is no way to log in**,
   which is why it comes first.

3. **Wire the dead config helpers.** `src/config/configuration.ts` exports
   `appConfig()` and `jwtConfig()` that nothing calls — `AuthModule` and
   `JwtStrategy` read `ConfigService.getOrThrow` directly. Either wire them or
   delete them; leaving a typed accessor layer that half the code ignores is
   worse than not having one.

4. **CI.** `.github/workflows/ci.yml` — there is no `.github/` at all today.
   postgres:16 service container; `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   then `migration:run` + `seed` + `pnpm test:e2e`. Landing CI here means
   every ticket after this one is guarded.

5. **Env vars** (via `/env-var`): `BOOTSTRAP_ADMIN_EMAIL`,
   `BOOTSTRAP_ADMIN_PASSWORD`, `RUNTIME_CACHE_MAX_AGE`.

**Done when**

- [ ] `pnpm seed` twice in a row leaves exactly one admin
- [ ] `POST /api/auth/login` with the seeded credentials returns tokens
- [ ] A `@Version('1')` route resolves at `/api/v1/...` and unversioned routes
      still resolve at `/api/...`
- [ ] CI is green on a pull request

---

## B2 — `locales`

*After B1.*

**Goal:** enabling a new language is an API call.

| Method | Path | Role |
|---|---|---|
| GET | `/locales` | any authenticated |
| POST | `/locales` | admin |
| PATCH | `/locales/:id` | admin |

No DELETE. `locales` is referenced `ON DELETE RESTRICT` from `apps`,
`app_locales` and `translation_values`; deactivation is `isActive = false`.

`PATCH` updates `name`, `nativeName`, `direction`, `isActive`. Not `code` —
it appears in runtime URLs.

**Invariants:** Rule 1. Uniqueness on `code` is `uq_locales_code`; do not
pre-check with a SELECT, let the constraint produce the 409.

**Tests:** creating `fr` succeeds and requires no migration — this is the one
that proves the central design decision still holds.

**Done when**

- [x] `POST /locales {code:'fr'}` returns 201, and a second one returns 409
- [x] A non-admin gets 403, not 401
- [x] `GET /locales` is paginated

---

## B3 — `apps` and app-locales

*After B2.*

**Goal:** applications exist, with their enabled languages and fallbacks.

Entity is `LocalizationApp` (named so it never reads as the Nest application).

| Method | Path | Role |
|---|---|---|
| GET | `/apps` | any authenticated |
| POST | `/apps` | admin |
| GET | `/apps/:id` | any authenticated |
| PATCH | `/apps/:id` | admin |
| GET | `/apps/:appId/locales` | any authenticated |
| POST | `/apps/:appId/locales/:localeCode/enable` | admin |
| DELETE | `/apps/:appId/locales/:localeCode/disable` | admin |
| PATCH | `/apps/:appId/locales/:localeCode/fallback` | admin |

**Notes**

- Creating an app writes `apps` **and** its default `app_locales` row
  (`isDefault: true`) in **one transaction**. An app with no default locale is
  a broken app, and the partial unique index cannot create the row for you.
- `slug` is absent from `UpdateAppDto`. `forbidNonWhitelisted` is on globally,
  so an attempt to change it is rejected at the pipe — Rule 8, enforced by
  leaving the field out rather than by a runtime check.
- Disabling the default locale → 422 from the service. A second default is
  already refused by `uq_app_locales_one_default`.
- A fallback pointing at itself is refused by `ck_app_locales_fallback_not_self`.

**Done when**

- [x] Creating an app with a bad `defaultLocaleCode` creates **no** app row
      (transaction rolls back)
- [x] Two defaults for one app → 409 from the partial unique index
- [x] Disabling the default locale → 422
- [x] `PATCH` with a `slug` in the body → 400

---

## B4 — `translation-modules`

*After B3.*

**Goal:** translation namespaces, app-scoped and global.

Directory `modules/translation-modules/`, class `TranslationModulesModule`,
service `TranslationModulesService`, table `modules` — per the naming-collision
table in `nestjs-module-structure.md`. `ModulesModule` is not a name.

Two controllers, one Nest module:

| Method | Path | Role | Scope |
|---|---|---|---|
| GET | `/apps/:appId/modules` | any authenticated | app |
| POST | `/apps/:appId/modules` | admin | app |
| GET | `/modules/global` | any authenticated | global |
| POST | `/modules/global` | admin | global |
| GET | `/modules/:id` | any authenticated | either |
| PATCH | `/modules/:id` | admin | either |

**Invariants:** Rule 2. `scope` and `app_id` are set **from the route** —
`/apps/:appId/modules` always produces `scope: 'app'`, `/modules/global`
always produces `scope: 'global', appId: null`. Never accept `scope` in the
body and never reconcile a mismatched pair in the service; a bad combination
is left to `ck_modules_scope_app_id` to reject as a 422.

`slug` is immutable (Rule 8) — absent from the update DTO.

**Done when**

- [x] Two `products` modules in one app → 409
- [x] Two global `authentication` modules → 409 (this is the one a plain
      `UNIQUE (app_id, slug)` would have allowed, because `NULL != NULL`)
- [x] A `products` module in app A and another in app B both succeed

---

## B5 — `entries`

*After B4.*

**Goal:** the translation keys, and the list endpoint the dashboard's main
table is built on.

| Method | Path | Role |
|---|---|---|
| GET | `/modules/:moduleId/entries` | any authenticated |
| POST | `/modules/:moduleId/entries` | admin, editor |
| GET | `/entries/:id` | any authenticated |
| PATCH | `/entries/:id` | admin, editor |
| DELETE | `/entries/:id` | admin |

**The list endpoint** returns `TranslationRow[]` (already declared in
`libs/contracts/src/translation.contracts.ts`): the key plus a `values` map
**keyed by locale code**. Supports `?search=` on key, `?missingLocale=ar` for
the missing-translation indicator, and pagination.

That map is built from rows at read time (Rule 1) — one query with a narrow
select joining `translation_values` and `locales`, grouped in JS. Not one
query per entry, and not `find()` (typeorm Rules 6 and 7). The response is
nested; the storage is not. Keeping those two shapes distinct is the whole
point of the design.

Entries carry no `appId` (Rule 3) — join through `modules` when the app is
needed.

`DELETE` cascades to values and their history. Admin only, and worth a second
thought before shipping: an archived entry may be the better default.

**Done when**

- [x] The list returns one row per entry with every locale's value keyed by
      code, including locales with no value yet
- [x] `?missingLocale=ar` returns only entries with no `ar` value
- [x] A module with 500 entries × 4 locales is one query, not 500
- [x] Two entries with the same key in one module → 409

---

## B6 — `translations` (values, publishing, history)

*After B5. The core ticket.*

| Method | Path | Role | Notes |
|---|---|---|---|
| PUT | `/entries/:entryId/translations/:localeCode` | admin, editor | upsert |
| POST | `/translations/:id/submit-review` | admin, editor | advisory |
| POST | `/translations/:id/publish` | admin, editor | |
| POST | `/translations/:id/archive` | admin | drops it from runtime |
| GET | `/translations/:id/history` | admin, editor | paginated, version DESC |
| POST | `/translations/:id/rollback/:version` | admin, editor | |

### The upsert, in order, each failure with its own code

1. Locale code unknown → **404**
2. Locale not enabled for the entry's app → **422**. Global modules have no
   app, so they accept any active locale.
3. `assertCanEditApp(user, appId)` → **403**. Role-only today (admins pass;
   editors pass); this is the seam where per-app assignment lands. Per
   `nestjs-auth.md` Rule 7 the *role* check stays on the decorator — only the
   *data-scope* question belongs in the service.
4. Content validation by `contentType` → **422**:
   - `icu_message` — parsed with `@formatjs/icu-messageformat-parser`, and its
     placeholder set must match the same entry's value in the app's default
     locale. Otherwise one language ships a message the others cannot
     interpolate, and it only fails at render time.
   - `rich_text` — run through a `sanitize-html` allowlist.
   - `text` — stored as-is.
5. Stale `expectedVersion` → **409 carrying the current value and version**,
   so the dashboard can show a diff (Rule 7). `version` is a TypeORM
   `@VersionColumn` and is never assigned by hand (typeorm Rule 8).
6. Write `translation_values` **and** `translation_value_versions` in **one
   transaction** (typeorm Rule 4). A published value with no audit row is
   precisely what the history table exists to prevent.

### Status transitions

```
(new)     ──────────────► draft
draft     ──publish─────► published   + published_at
draft     ──submit──────► in_review   (advisory; nothing blocks on it)
in_review ──publish─────► published   + published_at
published ──edit────────► published   (stays live — see the schema note above)
published ──archive─────► archived    (leaves the runtime bundle)
```

`ck_values_published_at` enforces that `published` and a non-null
`published_at` travel together.

### Rollback

A **forward** write: the historical value is written as a new version with
`changeNote: 'Rollback to vN'`. Nothing is ever deleted from
`translation_value_versions` (Rule 6). This satisfies the MVP criterion "a
published value can be rolled back".

**Done when**

- [x] Two concurrent writes with the same `expectedVersion`: one 200, one 409,
      never two 200s
- [x] Every write leaves exactly one new history row
- [x] Rollback to v2 produces v5, and v2 is still present in the history
- [x] Malformed ICU → 422, and ICU whose placeholders differ from the default
      locale's → 422
- [x] A crash between the value write and the history write leaves neither

**Decisions taken while building it**

- The optimistic-lock check is a `SELECT … FOR UPDATE` on the value row rather
  than a compare-and-set on `version`. TypeORM's `@VersionColumn` does not add
  a `WHERE version = ?` guard to an ordinary `save()`, and writing one by hand
  would mean assigning `version` in application code, which typeorm Rule 8
  forbids. The row lock serializes the two writers instead, so the loser reads
  the version the winner just wrote.
- `rich_text` is **sanitized and stored**, not compared against what was sent.
  Sanitizing rewrites as well as strips (`&` → `&amp;`), so an equality check
  would reject good copy. 422 is reserved for input where nothing survived —
  storing `''` there would look to the editor like the save worked.
- Rollback does not re-validate the historical value and does not change the
  status. It was valid when it was written, and refusing an emergency revert
  because the default locale's placeholders moved since is the wrong trade.
- `@formatjs/icu-messageformat-parser` is pinned to `^2` and `sanitize-html` to
  `2.17.0`. Their latest majors are ESM-only; this package is CommonJS against
  a `node >=20` floor, where `require(esm)` does not exist, and Jest does not
  transform `node_modules`. Upgrading either means moving the backend to ESM.
- `ListHistoryQueryDto` does not extend `PaginationQueryDto` — the one
  departure from HTTP contract Rule 2 in the API. The base class carries
  `search`, and an accepted-but-ignored `?search=` on a history endpoint is a
  contract that lies.

---

## B7 — `api-keys` and the service-credential guard

*After B3. Can run in parallel with B4–B6.*

**Goal:** client applications can authenticate to the runtime API without a
CMS user account.

### Migration `AddApiKeys`

Hand-written (`/new-migration`) — it needs a partial index, which TypeORM
cannot generate.

```
api_keys
  id           uuid pk default gen_random_uuid()
  app_id       uuid NOT NULL → apps ON DELETE CASCADE
  name         varchar(255) NOT NULL
  key_hash     varchar(255) NOT NULL UNIQUE
  prefix       varchar(12)  NOT NULL      -- displayable, e.g. cms_live_a3f9
  last_used_at timestamptz
  revoked_at   timestamptz
  created_by   uuid → users ON DELETE SET NULL
  created_at, updated_at timestamptz NOT NULL default now()

  CREATE INDEX ix_api_keys_app ON api_keys (app_id) WHERE revoked_at IS NULL
```

`app_id` is NOT NULL deliberately: a key is scoped to exactly one app, so a
leaked key cannot read another app's content.

Add the entity to **both** the barrel exports and the explicit `ENTITIES`
array in `libs/database/src/entities/index.ts` — the array is not derived from
the barrel, and a missing entry fails at connection time.

### The guard

This is the part that needs care. `nestjs-auth.md` Rule 2 caps `@Public()` at
exactly three routes and names the runtime endpoints as explicitly *not* an
exception. So the runtime routes do not become public — they authenticate
differently.

Introduce a `@ServiceCredential()` marker decorator. `JwtAuthGuard` reads the
reflector and, when it finds the marker, delegates to `ApiKeyGuard` instead of
running the JWT strategy. `ApiKeyGuard` takes `X-API-Key`, SHA-256s it, looks
up a non-revoked row, attaches `request.apiKey`, and touches `last_used_at`.

That keeps the guards global, keeps `@Public()` at three routes, and keeps the
authorization model greppable from the HTTP surface.

**Update `.claude/rules/nestjs-auth.md` Rule 2 and
`.claude/agents/audit-api-auth/AGENT.md` in the same PR** to recognise the
fourth marker. Otherwise the auditor reports every runtime route as a leak,
and the next person either believes it or learns to ignore the auditor.

Consider a separate throttler for runtime traffic, keyed by API key rather
than IP — client apps behind one NAT would otherwise share the default bucket.

### Admin CRUD

| Method | Path | Role |
|---|---|---|
| POST | `/apps/:appId/api-keys` | admin |
| GET | `/apps/:appId/api-keys` | admin |
| DELETE | `/api-keys/:id` | admin |

`POST` returns the plaintext key **exactly once** and never again — only the
hash is stored. `DELETE` sets `revoked_at`; it does not delete the row, so
`last_used_at` survives for the audit.

**Done when**

- [x] The plaintext key appears in the create response and in no other response
- [x] A revoked key → 401 — proven at the guard (`ApiKeyGuard` unit spec) and at
      the database (`resolve` returns `null` for a revoked key, e2e). The
      end-to-end HTTP half needs a `@ServiceCredential()` route, which arrives
      with B8.
- [x] A key for app A against app B's bundle → 403 — `assertServesApp`, unit
      and e2e. Same caveat: the bundle route itself is B8's.
- [x] `audit-api-auth` reports zero findings for the runtime routes — there are
      none yet; the auditor was taught the marker (A10/A11/A12) so that when
      B8 lands they are checked rather than reported as leaks.

**Decisions taken while building it**

- `prefix` is `cms_` + 8 hex = exactly 12 characters, matching the column. The
  plan's illustrative `cms_live_a3f9` is 13 and would have overflowed it.
- The full key is `<prefix>.<32 random bytes, base64url>`, and the **whole**
  string is hashed. The prefix is therefore both the displayable handle and the
  first segment of the secret, so a prefix in a log line matches a row.
- SHA-256, not argon2. The key is uniform randomness rather than a human-chosen
  password, so there is no dictionary to slow an attacker against — and this
  runs on the hot path of every runtime read.
- `last_used_at` is written at most once a minute per key. Writing it on every
  request would turn the cacheable read endpoint into a write on every hit.
- `DELETE /api-keys/:id` answers **200 with the revoked key**, not 204. The row
  survives, so there is something to return, and returning it lets the
  dashboard show when the key it just cut off was last used.

---

## B8 — Runtime read API

*After B6 and B7.*

**Goal:** the endpoint client apps actually call.

`@Controller({ path: 'apps/:appSlug/locales/:localeCode', version: '1' })`

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/apps/:appSlug/locales/:localeCode?includeGlobal=true` | `X-API-Key` |
| GET | `/api/v1/apps/:appSlug/locales/:localeCode/modules/:moduleSlug` | `X-API-Key` |
| GET | `/api/v1/apps/:appSlug/locales` | `X-API-Key` |

The third is not in the architecture doc but a client needs it to know which
languages to offer without hard-coding them — which is the same mistake §4
exists to prevent, one layer up.

**Behaviour**

- `status = 'published'` lives **in the WHERE clause**, never in a post-filter
  (Rule 4). The existing partial index `ix_values_locale_published` covers it.
- Narrow select — `module.slug`, `entry.key`, `value.value` — not full
  entities with relations (typeorm Rule 7). The difference is one query versus
  thousands.
- `RESOLUTION_ORDER` from `@cms/domain` is implemented **once**, in
  `RuntimeService` (Rule 5): app entry → global entry → the app's configured
  fallback locale → the key itself. The dashboard preview and any future
  `i18n-client` adapter call this endpoint rather than reimplementing the
  chain.
- `releaseId = sha256(max(published_at) + ':' + count).slice(0, 16)` over the
  same row set, emitted as the `ETag`, with
  `Cache-Control: public, max-age=${RUNTIME_CACHE_MAX_AGE}, stale-while-revalidate=300`
  and a **304** on a matching `If-None-Match`.
- The presented API key must belong to `:appSlug` → 403 otherwise.

Response shape is `TranslationBundleResponse` from `@cms/domain`: `appSlug`,
`localeCode`, `releaseId`, and `bundle` keyed by module slug then entry key.

**Done when**

- [ ] A `draft` value is absent from the bundle — the test the invariants rule
      requires by name
- [ ] Publishing any value changes the `releaseId`
- [ ] `If-None-Match` with the current ETag → 304 with no body
- [ ] A key missing in the requested locale falls back to the configured
      fallback locale, then to the key itself
- [ ] An app-scoped entry overrides a global entry with the same key
- [ ] `?includeGlobal=false` omits global modules entirely
- [ ] **Every** runtime handler calls `ApiKeysService.assertServesApp`, and a
      key issued for app A gets 403 against app B's bundle over HTTP

The last box is a review gate, not a formality. B7 shipped `assertServesApp`
with no production call site — the helper existing is not the protection, B8
calling it is. A runtime handler that resolves `:appSlug` without asking the
question serves one customer's copy to another's key, and nothing upstream
will catch it: `ApiKeyGuard` only establishes *that* the credential is valid,
never *where*.

---

## B9 — `users` admin module

*After B1. Parallel with B2–B8.*

**Goal:** admins manage users; disabling a user actually locks them out.

| Method | Path | Role |
|---|---|---|
| GET | `/users` | admin |
| GET | `/users/:id` | admin |
| POST | `/users` | admin |
| PATCH | `/users/:id` | admin |
| POST | `/users/:id/disable` | admin |
| POST | `/users/:id/enable` | admin |
| POST | `/users/me/password` | any authenticated |

`UsersService` exists today but has no controller at all.

`POST /users` creates with status `invited`. `PATCH` updates `name` and
`role` — not `email` (it is the login identity and CITEXT-unique) and not
`status` (that is what disable/enable are for).

**Disabling and a password change both revoke every refresh session for that
user**, reusing the revoke-all path already in `AuthService`. `JwtStrategy`
already re-reads the user and rejects non-`active` accounts, so the access
token stops working on the next request rather than at expiry. This is an MVP
acceptance criterion, and the two halves — revoke sessions, reject the token —
have to both be true or a disabled user keeps working for up to 15 minutes.

`passwordHash` is `select: false` on the entity. Never return the entity;
map to a response shape.

**Done when**

- [ ] Disabling a user makes their existing access token fail on the next
      request, not at expiry
- [ ] Disabling revokes every `refresh_sessions` row for that user
- [ ] Changing a password revokes every session, including the current one
- [ ] No response anywhere contains `passwordHash`
- [ ] An editor calling `GET /users` gets 403

---

## B10 — E2E suite

*After B8.*

`apps/backend/test/`, Jest, against a real migrated Postgres, `--runInBand`.
No e2e file exists today. Each test owns its data and cleans up after itself.

- **`auth.e2e-spec.ts`** — enumerate every registered route from the Nest
  router and assert 401 without a token. This is the test that catches a
  future endpoint someone forgot to think about, which no per-endpoint test
  can do. Also: a valid editor on an admin route gets **403, not 401** — the
  dashboard logs people out on 401, so collapsing the two logs users out for
  opening a page they merely lack permission for.
- **`runtime.e2e-spec.ts`** — no draft leaks; 304 on `If-None-Match`; fallback
  locale resolution; app-over-global resolution; a revoked API key.
- **`translations.e2e-spec.ts`** — 409 on stale `expectedVersion`; one history
  row per write; rollback writes forward.

**Done when**

- [ ] Every route is covered by the 401 sweep automatically, with no
      hand-maintained list
- [ ] `pnpm test:e2e` passes in CI against the service container

---

## B11 — Importer CLI

*After B6. This is architecture doc Phase 4.*

New workspace package `libs/importer`, depending on `@cms/database` and
`@cms/domain`. It calls the same services the HTTP layer does — which is why
`nestjs-module-structure.md` puts the domain logic in services rather than
controllers.

**Pipeline** (architecture doc §11)

1. Discover locale files in the source monorepo (`fast-glob`)
2. Parse each path into app / module / locale
3. Flatten nested JSON into stable dotted keys
4. Validate key parity across `ar` and `en`
5. Report missing, duplicate, malformed and conflicting values
6. Write apps, modules, entries and values — the whole batch in one
   transaction
7. Compare CMS API output against the original JSON

**`--dry-run` is the default.** `--commit` is the flag you have to type.

Idempotent (Rule 9): a second run inserts zero rows and reports zero
conflicts, achieved by upserting on `(module, key)` and `(entry, locale)`.
Every run records the source commit SHA and writes its report **before**
touching the database.

**Done when**

- [ ] Running twice against the same source imports zero rows the second time
- [ ] A dry run writes a report and makes no database changes whatsoever
- [ ] A key present in `en` but missing in `ar` appears in the report rather
      than failing the import
- [ ] The report names the source commit SHA
- [ ] `GET /v1/...` output matches the original JSON bundle for a pilot module

---

## B12 — Close the loop on the docs

*Last.*

- Point architecture doc §15 at the decision table in this document, so §15
  stays a record of what was proposed and this stays a record of what was
  chosen.
- Move `CLAUDE.md`'s "Current phase" marker to 2, and update the "Open
  decisions" section — it currently lists five items that this plan resolves.
- Add the runtime endpoints and the `X-API-Key` scheme to the Swagger document
  so `/docs` is a usable integration reference for client teams.

---

## MVP acceptance criteria, mapped

Architecture doc §14, against the tickets that satisfy each one.

| Criterion | Ticket |
|---|---|
| Log in, receive a short-lived access token | done (B1 makes it reachable) |
| Protected APIs reject requests with no Bearer token | done; B10 proves it for every route |
| Expired tokens renew through the refresh flow | done |
| Logout and deactivation revoke refresh sessions | logout done; deactivation B9 |
| Admins manage applications, modules, locales, users | B2, B3, B4, B9 |
| Editors create keys and edit translations in permitted scopes | B5, B6 (role-only scope; see the decision table) |
| Arabic and English work end to end, including RTL | B2, B3, B8 |
| A new locale is enabled with no migration | B2 |
| Global translations reusable, app values override predictably | B4, B8 |
| Only published content is returned by runtime APIs | B8, proven in B10 |
| Existing JSON imported and validated idempotently | B11 |
| Clients retain a safe fallback when the API is unavailable | B8 (`Cache-Control` + `stale-while-revalidate`); the client-side half is the dashboard/i18n-client plan |
| Every change records who changed what and when | B6 |
| A published value can be rolled back | B6 |
