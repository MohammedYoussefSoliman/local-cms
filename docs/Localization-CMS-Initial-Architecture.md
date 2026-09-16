# Localization CMS — Initial Architecture & Delivery Plan

<aside>
🎯

Centralize application copy in a localization CMS so non-technical team members can create, translate, review, and publish content without requiring frontend code changes.

</aside>

## 1. Context

Today, Arabic and English translations are stored as JSON files inside each frontend module. Adding or changing content requires a developer to edit the locale files and deploy the application.

The proposed system will move translation ownership to a central CMS. Client applications will retrieve published translations from a backend API and integrate them with the existing i18n setup.

### Initial technology choices

- **Backend:** NestJS
- **Database:** PostgreSQL
- **Admin dashboard:** React
- **Authentication:** JWT Bearer authentication
- **Workspace:** pnpm monorepo, with packages under `libs/`
- **Initial languages:** Arabic (`ar`) and English (`en`)
- **Future languages:** Any language supported by a configurable locale registry

## 2. Goals

- Give authorized non-technical users a safe interface for managing application copy.
- Remove manually maintained localization JSON files from frontend modules.
- Support any number of languages without database schema changes.
- Organize translations by application and business module.
- Reuse global terms such as `login`, `logout`, and `sign_up` across applications.
- Expose versioned, cacheable APIs compatible with the current i18n integration.
- Import existing locale files without losing translation keys or values.
- Support review, publication, audit history, and rollback.

## 3. Non-goals for the first release

- Replacing the application's i18n runtime library.
- Machine translation as the authoritative source of content.
- Visual editing inside the product UI.
- Advanced translation-memory or vendor-management workflows.

## 4. Key design decision: normalize languages as rows

Do **not** add a PostgreSQL column for each new language. Columns such as `ar`, `en`, `fr`, and `es` make every added language require a migration and produce increasingly wide tables.

Instead:

- Store supported languages in a `locales` table.
- Store each translation as one row identified by a content entry and a locale.
- Keep the API response shaped as nested JSON for easy i18n consumption.

Example API output:

```json
{
  "products": {
    "add_to_cart": "Add to cart",
    "out_of_stock": "Out of stock"
  }
}
```

Arabic is returned by requesting the same namespace with `locale=ar`.

## 5. Domain model

### User

A person who can access the CMS.

Initial roles:

- **Admin:** manages applications, modules, locales, users, and publishing.
- **Editor:** creates and edits localization entries and translations within assigned scopes.

The authorization model should be extensible to roles such as reviewer and translator.

### Authentication and authorization

The application will use JWT authentication. Users first authenticate through the login endpoint. Every subsequent CMS and runtime API request must include the access token in the HTTP header:

```
Authorization: Bearer <access-token>
```

The login and token-refresh endpoints are the only authentication endpoints that do not require an existing access token.

NestJS implementation requirements:

- Use a global JWT authentication guard so endpoints are protected by default.
- Mark login, refresh, and health-check endpoints as explicitly public rather than applying guards endpoint by endpoint.
- Add a role/permission guard after authentication for admin- and editor-specific operations.
- Keep access tokens short-lived and use a refresh-token flow for longer sessions.
- Rotate refresh tokens and store only a hash of each active refresh token or session identifier on the server.
- Revoke active refresh sessions when a user is disabled, signs out, or changes credentials.
- Return `401 Unauthorized` for a missing, invalid, or expired token.
- Return `403 Forbidden` when the authenticated user lacks the required permission.
- Validate the JWT issuer, audience, signature, subject, and expiration.
- Never store signing secrets or private keys in source control; load them from the deployment secret manager.
- Require HTTPS in deployed environments.
- Configure the React API client to attach the Bearer token consistently and handle expiration through a controlled refresh-and-retry flow.

For browser security, prefer keeping the short-lived access token in memory. If refresh tokens are used by the dashboard, store them in `HttpOnly`, `Secure`, appropriately configured `SameSite` cookies rather than browser local storage.

### Application

A client application that consumes localized content—for example, a storefront, dashboard, or mobile app.

### Module

A translation namespace aligned with a business module in an application, such as `products`, `checkout`, or `authentication`.

Each application can have many modules. A module name should remain stable because it becomes part of the runtime translation path.

### Global module

A reusable namespace for shared terms such as authentication actions and common buttons. Global entries should not be copied into every application.

Recommended resolution order:

1. Application-specific entry
2. Global entry
3. Configured fallback locale
4. Translation key as the final development fallback

### Translation entry

The language-independent identity of a piece of copy—for example, `products.add_to_cart`.

### Translation value

The localized value for one entry and one locale.

## 6. Recommended PostgreSQL schema

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `email` | CITEXT | Unique |
| `name` | VARCHAR | Display name |
| `role` | ENUM/VARCHAR | `admin` or `editor` initially |
| `status` | ENUM/VARCHAR | `active`, `invited`, `disabled` |
| `created_at` | TIMESTAMPTZ | Audit field |
| `updated_at` | TIMESTAMPTZ | Audit field |

### `apps`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `name` | VARCHAR | Human-readable name |
| `slug` | VARCHAR | Unique stable API identifier |
| `description` | TEXT | Optional |
| `default_locale_id` | UUID | FK to `locales` |
| `created_at` | TIMESTAMPTZ | Audit field |
| `updated_at` | TIMESTAMPTZ | Audit field |

### `locales`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `code` | VARCHAR | Unique BCP 47 code, e.g. `ar`, `en`, `fr` |
| `name` | VARCHAR | e.g. Arabic |
| `native_name` | VARCHAR | e.g. العربية |
| `direction` | ENUM/VARCHAR | `ltr` or `rtl` |
| `is_active` | BOOLEAN | Availability in CMS |
| `created_at` | TIMESTAMPTZ | Audit field |

### `app_locales`

Defines the languages enabled for each application.

| Column | Type | Notes |
| --- | --- | --- |
| `app_id` | UUID | FK to `apps` |
| `locale_id` | UUID | FK to `locales` |
| `is_default` | BOOLEAN | One default per app |
| `fallback_locale_id` | UUID | Optional fallback |
| `is_enabled` | BOOLEAN | Runtime availability |

Unique constraint: (`app_id`, `locale_id`).

### `modules`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `app_id` | UUID, nullable | FK to `apps`; null for global modules |
| `name` | VARCHAR | Display name |
| `slug` | VARCHAR | Stable namespace |
| `scope` | ENUM/VARCHAR | `app` or `global` |
| `description` | TEXT | Optional |
| `created_at` | TIMESTAMPTZ | Audit field |
| `updated_at` | TIMESTAMPTZ | Audit field |

Constraints:

- App module: `scope = 'app'` and `app_id IS NOT NULL`.
- Global module: `scope = 'global'` and `app_id IS NULL`.
- Unique app namespace: (`app_id`, `slug`).
- Unique global namespace: `slug` where scope is global.

### `translation_entries`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `module_id` | UUID | FK to `modules` |
| `key` | VARCHAR | Stable key, e.g. `add_to_cart` |
| `description` | TEXT | Context for translators |
| `content_type` | ENUM/VARCHAR | `text`, `rich_text`, or `icu_message` |
| `created_by` | UUID | FK to `users` |
| `created_at` | TIMESTAMPTZ | Audit field |
| `updated_at` | TIMESTAMPTZ | Audit field |

Unique constraint: (`module_id`, `key`).

The entry does not need a separate `app_id`; its module already determines whether it belongs to an application or the global scope. Avoiding the duplicate foreign key prevents inconsistent data.

### `translation_values`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `entry_id` | UUID | FK to `translation_entries` |
| `locale_id` | UUID | FK to `locales` |
| `value` | TEXT | Localized content |
| `status` | ENUM/VARCHAR | `draft`, `in_review`, `published`, `archived` |
| `version` | INTEGER | Optimistic concurrency/versioning |
| `updated_by` | UUID | FK to `users` |
| `published_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Audit field |
| `updated_at` | TIMESTAMPTZ | Audit field |

Unique constraint: (`entry_id`, `locale_id`).

### `translation_value_versions`

An append-only history table for audit and rollback.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `translation_value_id` | UUID | FK to `translation_values` |
| `version` | INTEGER | Version number |
| `value` | TEXT | Historical value |
| `status` | VARCHAR | Historical status |
| `changed_by` | UUID | FK to `users` |
| `change_note` | TEXT | Optional |
| `created_at` | TIMESTAMPTZ | Change time |

## 7. Relationship overview

```
users ───────────────< translation_entries
  │
  └─────────────────< translation_values

apps ────────────────< modules ─────────────< translation_entries
  │                                              │
  └─────────────────< app_locales                └──────────────< translation_values
                            >──────── locales ────────────────────┘

modules.app_id = null + scope = global → shared/global namespace
```

## 8. Review of the initial TypeScript model

![Initial localization types](Localization%20CMS%20%E2%80%94%20Initial%20Architecture%20&%20Delivery/299bb362-86d5-4bea-a6ef-0bc59d6f5747.png)

Initial localization types

Recommended changes to the draft:

- Replace `DefaultLanguage` as the database source of truth with configurable locale records. It can remain a bootstrap/runtime constant for `ar` and `en`.
- Avoid `Record<DefaultLanguage, string>` in persisted entities because it limits the model to compile-time languages.
- Use `TranslationEntry` for the key and `TranslationValue[]` for localized values.
- Remove `app_id` from the localized value when it can be derived through the entry's module.
- Correct the comment on `module_id`; it references a module, not an app.
- Use UUIDs and database constraints for identifiers and uniqueness.

Suggested domain types:

```tsx
export type Locale = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
};

export type TranslationValue = {
  id: string;
  localeCode: string;
  value: string;
  status: 'draft' | 'in_review' | 'published' | 'archived';
  version: number;
};

export type TranslationEntry = {
  id: string;
  moduleId: string;
  key: string;
  description?: string;
  contentType: 'text' | 'rich_text' | 'icu_message';
  translations: TranslationValue[];
};

export type LocalizationModule = {
  id: string;
  appId: string | null;
  name: string;
  slug: string;
  scope: 'app' | 'global';
};
```

## 9. API outline

### Authentication endpoints

- `POST /auth/login` — public; validates credentials and starts a session
- `POST /auth/refresh` — public to the JWT guard but requires a valid refresh token
- `POST /auth/logout` — protected; revokes the active refresh session
- `GET /auth/me` — protected; returns the authenticated user and permissions

All endpoints below require `Authorization: Bearer &lt;access-token&gt;` unless an endpoint is explicitly documented as public.

### CMS/admin endpoints

- `POST /apps`
- `GET /apps`
- `POST /apps/:appId/modules`
- `POST /modules/:moduleId/entries`
- `PUT /entries/:entryId/translations/:localeCode`
- `POST /translations/:translationId/submit-review`
- `POST /translations/:translationId/publish`
- `GET /translations/:translationId/history`
- `POST /locales`
- `POST /apps/:appId/locales/:localeCode/enable`

### Runtime endpoints

- `GET /v1/apps/:appSlug/locales/:localeCode`
- `GET /v1/apps/:appSlug/locales/:localeCode/modules/:moduleSlug`
- `GET /v1/apps/:appSlug/locales/:localeCode?includeGlobal=true`

Runtime responses should include only published values and support:

- `ETag` / `If-None-Match`
- `Cache-Control`
- a content version or release identifier
- locale fallback
- global/app-specific resolution
- optional module-level retrieval to avoid oversized payloads

## 10. Frontend integration strategy

1. Keep the current i18n library.
2. Add an HTTP backend/loader that requests translations before or during app initialization.
3. Cache the last successful translation bundle locally or at the CDN edge.
4. Use the application's bundled default locale as a temporary emergency fallback during migration.
5. After the CMS proves stable, remove the old locale JSON files.

Avoid deleting existing locale files before the API, cache behavior, and fallback path are production-ready.

## 11. Migration and hydration plan

1. Discover all locale files in every application and module.
2. Parse the folder path into `app`, `module`, and `locale`.
3. Flatten nested JSON keys into stable dotted keys when necessary.
4. Validate that keys match across `ar` and `en`.
5. Report missing, duplicate, malformed, and conflicting values.
6. Create apps, modules, entries, and translation values in a transaction-safe import.
7. Run the importer in dry-run mode first.
8. Compare CMS API output with the existing JSON resources.
9. Preserve an import report and source commit SHA for auditability.
10. Make the import idempotent so it can be rerun safely.

## 12. Proposed monorepo structure

```
labs/localization-cms/
├── apps/
│   ├── api/                 # NestJS backend
│   └── dashboard/           # React admin UI
├── packages/
│   ├── database/            # schema, migrations, seeds
│   ├── domain/              # shared domain types and rules
│   ├── contracts/           # API DTOs and generated client types
│   ├── i18n-client/         # integration adapter for client apps
│   ├── importer/            # JSON discovery and hydration CLI
│   ├── config/              # shared tooling configuration
│   └── ui/                  # shared dashboard components
├── docker-compose.yml       # local PostgreSQL and dependencies
├── pnpm-workspace.yaml
└── package.json
```

The exact layout should be aligned with the existing frontend monorepo after it is shared.

## 13. Delivery phases

### Phase 1 — Foundation

- Review the existing frontend monorepo conventions.
- Initialize the pnpm workspace under `labs/`.
- Create the NestJS API and React dashboard packages.
- Configure PostgreSQL, migrations, linting, formatting, tests, and CI.
- Confirm the ERD and domain rules.

### Phase 2 — Backend MVP

- Implement JWT login, refresh-token rotation, logout/revocation, and global Bearer-token protection.
- Implement role-based authorization.
- Implement locales, apps, modules, entries, and values.
- Add validation, uniqueness constraints, audit history, and publication workflow.
- Build runtime read APIs with caching and fallback behavior.

### Phase 3 — Dashboard

- Create application and module management views.
- Add translation table/editor with locale columns generated dynamically.
- Add search, filtering, missing-translation indicators, and status controls.
- Add RTL-aware previews and permission-based actions.

### Phase 4 — Data hydration

- Build the import CLI.
- Run dry-run validation against current locale files.
- Import existing content and reconcile differences.
- Verify API output against current JSON bundles.

### Phase 5 — Deployment and testing

- Deploy API, dashboard, and PostgreSQL.
- Test permissions, editing, publication, fallback, caching, RTL, concurrency, and rollback.
- Run load tests for runtime endpoints.
- Add health checks, logs, metrics, backups, and alerts.

### Phase 6 — Demo and integration

- Demonstrate the editor and publication workflow.
- Integrate one pilot application and module.
- Run side-by-side comparison with the JSON implementation.
- Roll out to remaining applications incrementally.
- Remove local JSON resources only after each application passes acceptance checks.

## 14. MVP acceptance criteria

- Users can log in and receive a short-lived JWT access token.
- Every protected API rejects requests without a valid Bearer token.
- Expired access tokens can be renewed through the controlled refresh-token flow.
- Logout and user deactivation revoke refresh sessions.
- Admins can manage applications, modules, locales, and users.
- Editors can create keys and edit translations only in permitted scopes.
- Arabic and English work end to end, including RTL behavior.
- A new locale can be enabled without a database migration.
- Global translations are reusable and app-specific values can override them predictably.
- Only published content is returned by runtime APIs.
- Existing JSON files can be imported and validated through an idempotent process.
- Clients retain a safe fallback when the CMS API is unavailable.
- Every change records who changed what and when.
- A published value can be rolled back.

## 15. Open decisions

- ORM and migration tool: Prisma, Drizzle, or TypeORM.
- Credential source and JWT issuer: existing identity provider or CMS-managed authentication.
- Access-token lifetime, refresh-token lifetime, signing algorithm, issuer, and audience.
- Whether editors are assigned by application, module, or both.
- Review requirement: direct publishing versus editor/reviewer approval.
- Message format: plain text only or ICU MessageFormat for interpolation and plurals.
- Global override rules and whether specific global modules can be enabled per app.
- Release model: publish each value immediately or publish a versioned bundle.
- Hosting, CDN, and cache invalidation strategy.
- Expected number of applications, modules, keys, locales, and runtime requests.

## 16. Immediate next steps

- [ ]  Share the frontend monorepo structure and root configuration files.
- [ ]  Confirm that “PMBM” means **pnpm**.
- [ ]  Choose the ORM and migration strategy.
- [ ]  Confirm role and publishing workflow requirements.
- [ ]  Approve the normalized locale/value schema.
- [ ]  Produce the ERD in eraser.io.
- [ ]  Initialize the workspace and backend skeleton.
- [ ]  Inventory existing locale folders for the importer.