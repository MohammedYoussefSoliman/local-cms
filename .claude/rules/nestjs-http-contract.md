---
paths:
  - 'apps/backend/src/**/*.controller.ts'
  - 'apps/backend/src/**/dto/*.ts'
  - 'libs/contracts/**'
---

# API HTTP Contract

One request shape, one response shape, one error shape — defined in
`@cms/contracts` and consumed unchanged by the dashboard.

---

## Rule 1 — Every input is a DTO class with validators

`ValidationPipe` runs globally with `whitelist: true` and
`forbidNonWhitelisted: true`. A property with no decorator is **stripped**, so
an undecorated field silently arrives as `undefined` rather than failing.

```ts
// ✅
export class CreateAppDto {
  @IsString() @Length(1, 255) name: string;
  @IsString() @Matches(/^[a-z0-9-]+$/) slug: string;
  @IsOptional() @IsString() description?: string;
}

// ❌ — `slug` is stripped by whitelist; the insert fails on a NOT NULL column
export class CreateAppDto {
  @IsString() name: string;
  slug: string;
}

// ❌ — a type is not runtime validation
create(@Body() dto: CreateAppPayload) {}
```

`whitelist` is also the defence against mass assignment: a client cannot
smuggle `role: 'admin'` into a profile update, because the property does not
exist on the DTO.

---

## Rule 2 — Query params need `@Type`

Query strings are strings. `@IsInt()` on `?page=2` fails without an explicit
transform, and `enableImplicitConversion` is deliberately **off** (it coerces
in surprising places, e.g. turning `"false"` into `true`).

```ts
// ✅
@IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;

// ❌
@IsOptional() @IsInt() page: number = 1;
```

Extend `PaginationQueryDto` from `@/common` rather than redeclaring
`page`/`limit`/`search`.

---

## Rule 3 — DTOs live in the API, shared types live in `@cms/contracts`

`libs/contracts` must stay free of `class-validator` and `class-transformer`
so the dashboard does not pull decorators and `reflect-metadata` into the
browser bundle.

```
libs/contracts/  →  CreateAppPayload  (plain type, imported by both sides)
apps/backend/…/dto/  →  CreateAppDto      (class + decorators, API only)
```

Keep them aligned: `CreateAppDto implements CreateAppPayload` makes a drift a
compile error rather than a runtime 400 nobody can explain.

---

## Rule 4 — Controllers return plain data

`ResponseInterceptor` adds the `{ data, message, statusCode }` envelope.
Building it in a controller produces a double-wrapped body.

---

## Rule 5 — Never return an entity directly

Entities carry columns the client must never see (`passwordHash`), lazy
relations that serialize into surprise queries, and internal column names.
Map to a response type explicitly.

```ts
// ❌ — one `select: false` slip away from leaking a password hash
return this.users.findAll();

// ✅
const users = await this.users.findAll();
return users.map(({ id, email, name, role, status }) => ({ id, email, name, role, status }));
```

---

## Rule 6 — Status codes carry meaning

| Situation                                   | Code |
| ------------------------------------------- | ---- |
| Created a resource                          | 201  |
| Updated / published                         | 200  |
| Deleted, nothing to return                  | 204  |
| Validation failed                           | 400  |
| No / invalid / expired token                | 401  |
| Valid identity, insufficient role           | 403  |
| Unique constraint hit (duplicate slug, key) | 409  |
| Stale `expectedVersion` on a translation    | 409  |
| Domain CHECK violated (bad module scope)    | 422  |

`HttpExceptionFilter` already maps Postgres `23505` → 409 and `23514` → 422,
so a duplicate slug surfaces as a usable message instead of a 500. Do not
pre-check uniqueness with a `SELECT` and then insert — that race is exactly
what the constraint is for.

---

## Rule 7 — Runtime read endpoints are cacheable

`GET /v1/apps/:appSlug/locales/:localeCode` must send `ETag` and
`Cache-Control`, and honour `If-None-Match` with a 304. The `releaseId` in
`TranslationBundleResponse` changes whenever any value in the bundle is
published, and is what the ETag is derived from.

A bundle endpoint without caching turns every client app's cold start into a
full table read.
