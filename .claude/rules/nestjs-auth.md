---
paths:
  - 'apps/backend/src/**'
---

# API Authentication & Authorization

Every endpoint is protected by default. This is the inverse of guarding route
by route, and the reason is that the failure modes are asymmetric: a forgotten
`@UseGuards()` silently exposes data, while a forgotten `@Public()` produces a
loud 401 in development.

---

## Rule 1 — Guards are global, in this order

Registered in `apps/backend/src/app.module.ts`:

```ts
{ provide: APP_GUARD, useClass: ThrottlerGuard },
{ provide: APP_GUARD, useClass: JwtAuthGuard },
{ provide: APP_GUARD, useClass: RolesGuard },
```

Nest runs global guards in registration order. `RolesGuard` reads
`request.user`, which only exists after `JwtAuthGuard` has run — reordering
these makes every role-guarded endpoint 403 for everyone.

Never add `@UseGuards(JwtAuthGuard)` to a controller. It is already global;
the duplicate runs the strategy twice.

---

## Rule 2 — `@Public()` is a review-blocking change

Exactly three routes may carry it:

| Route           | Why                                              |
| --------------- | ------------------------------------------------ |
| `POST /auth/login`   | there is no token yet                       |
| `POST /auth/refresh` | the access token is expected to be expired  |
| `GET /health`        | a probe that needs a token is not a probe   |

Anything else is a leak. If a new endpoint "needs" to be public, that is a
product decision about anonymous access, not a decorator choice — raise it
rather than adding the decorator.

The runtime translation endpoints are **not** an exception. They serve
published content to client apps, but they still authenticate — with a
service credential, not an editor session.

---

## Rule 3 — 401 and 403 mean different things

- **401** — no token, malformed token, expired token, revoked session. The
  dashboard's response to this is refresh-then-retry, and on failure, log out.
- **403** — a valid identity without the required role. The dashboard shows
  "you don't have access" and must **not** log the user out.

Collapsing them makes the dashboard log people out for opening a page they
merely lack permission for.

---

## Rule 4 — Validate issuer and audience, not just the signature

`JwtStrategy` passes `issuer` and `audience` to passport-jwt. A token minted
by another service that happens to share the secret is otherwise accepted:
signature-only validation is what turns one leaked secret into a cross-service
compromise.

---

## Rule 5 — Refresh tokens are hashed, opaque, and rotated

```ts
// ✅ — random bytes, stored as a SHA-256 hash
const refreshToken = randomBytes(48).toString('base64url');
await sessions.save({ tokenHash: sha256(refreshToken), expiresAt });

// ❌ — a JWT refresh token carries claims something will eventually trust
const refreshToken = jwt.sign({ sub: user.id }, refreshSecret);

// ❌ — a stored plaintext token is a database dump away from being a login
await sessions.save({ token: refreshToken });
```

Rotation rules, implemented in `AuthService.refresh`:

- The presented session is revoked and a new one is issued, in that order.
- Presenting an **already-revoked** token means it leaked: revoke every
  session for that user, not just this one.
- Logout, account disable, and credential change revoke all active sessions.

---

## Rule 6 — Re-read the user on every request

`JwtStrategy.validate` loads the user and rejects a non-`active` account, then
takes `role` from the database rather than from the token. Without this, a
disabled account keeps working until its access token expires, and a
demotion from admin to editor does the same.

---

## Rule 7 — Roles are checked with `@Roles()`, never inside a service

```ts
// ✅
@Roles('admin')
@Post('locales')
create(@Body() dto: CreateLocaleDto) { ... }

// ❌ — invisible to any audit of the HTTP surface
create(dto: CreateLocaleDto, user: AccessTokenClaims) {
  if (user.role !== 'admin') throw new ForbiddenException();
}
```

The decorator keeps the authorization model greppable. Scope checks that
depend on *data* ("may this editor touch this app?") do belong in the service —
that is a different question from "which role".

---

## Rule 8 — Secrets come from config, validated at boot

`env.validation.ts` requires both JWT secrets to be ≥32 characters and to
differ from each other in production. `process.env` is never read outside
`apps/backend/src/config/`.

A secret is never committed, never defaulted to a working value, and never
logged. `.env.example` carries placeholders only.

---

## Checklist for every new endpoint

1. Does it need `@Roles()`? Decide explicitly; record the answer in the PR.
2. Is it accidentally `@Public()`?
3. Does it read `request.user` directly instead of `@CurrentUser()`?
4. If it mutates another user's data, does the service check scope as well as
   role?
5. Is there a spec asserting 401 without a token and 403 with the wrong role?
