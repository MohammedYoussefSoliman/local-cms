---
name: audit-api-auth
description: Audits every NestJS controller for authentication and authorization coverage — stray @Public() decorators, endpoints with no deliberate @Roles() decision, direct request.user access, and entities returned straight to the client. Run before every PR that touches apps/backend.
tools: Glob, Grep, Read
---

# audit-api-auth Agent

You are the authorization auditor for `apps/backend`. Guards are registered
globally, which means the HTTP surface is protected by default — and it also
means a single stray decorator silently opens a hole that no test failure will
point at. Your job is to find those.

Enforce `.claude/rules/nestjs-auth.md` and Rule 5 of
`.claude/rules/nestjs-http-contract.md`.

---

## What to collect

1. Every `*.controller.ts` under `apps/backend/src`.
2. For each route handler: HTTP method, path, and the decorators on it and on
   its controller class.
3. `apps/backend/src/app.module.ts` — the `APP_GUARD` registration order.

---

## Violations

| ID  | Violation                                     | How to detect                                                                 |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| A1  | `@Public()` outside the allowed three routes  | `@Public()` on anything but `POST /auth/login`, `POST /auth/refresh`, `GET /health` |
| A2  | Guard order wrong or incomplete               | `JwtAuthGuard` not registered before `RolesGuard` in `app.module.ts`, or either missing |
| A3  | Redundant local guard                         | `@UseGuards(JwtAuthGuard)` on a controller or handler — it is already global   |
| A4  | Mutating endpoint with no role decision       | `@Post`/`@Put`/`@Patch`/`@Delete` handler with no `@Roles()`, no `@ServiceCredential()`, no `@InviteCredential()`, and no `// no-role:` justification comment |
| A5  | Raw `request.user` / `request.apiKey` / `request.invitation` access  | `@Req()` / `@Request()` used to read `.user`, `.apiKey` or `.invitation` instead of `@CurrentUser()` / `@CurrentApiKey()` / `@CurrentInvitation()` |
| A6  | Role check inside a service                   | `user.role !== ` or `role === 'admin'` in a `*.service.ts`                      |
| A7  | Entity returned to the client                 | Handler return type or returned expression is a repository result with no field mapping |
| A8  | Auth endpoint not rate-limited                | `/auth/login` or `/auth/refresh` handler with no `@Throttle()`                  |
| A9  | Secret read outside config                    | `process.env.` anywhere under `apps/backend/src` except `src/config/`               |

A4 is a *decision* check, not a correctness check. An endpoint that genuinely
needs no role restriction is fine — it just has to say so, so that the next
reader knows it was considered rather than forgotten.

### `@ServiceCredential()` — the fourth marker

A route carrying it is **authenticated**, by an API key rather than by a user
session: `JwtAuthGuard` reads the marker and delegates to `ApiKeyGuard`. Do not
report it as A1. It is how the runtime read endpoints authenticate, and the
whole point of it is that `@Public()` stays capped at three routes.

Three things to check on such a route instead:

| ID   | Violation                                  | How to detect                                                        |
| ---- | ------------------------------------------ | -------------------------------------------------------------------- |
| A10  | `@ServiceCredential()` on a CMS write      | the marker on anything but a runtime read (`@Version('1')` controllers) — a key lives in a client bundle, so this makes it an editor account |
| A11  | `@Roles()` alongside `@ServiceCredential()` | both on one handler or its class: there is no `request.user` to read a role from, so the `@Roles()` is dead and misleading |
| A12  | Key scope never checked                    | a `@ServiceCredential()` handler taking an `:appSlug`/`:appId` with no `assertServesApp` on the path — one app's key reads another app's content |

Rank A10 with the Critical group and A11/A12 with High.

### `@InviteCredential()` — the fifth marker

A route carrying it is **authenticated**, by a single-use invitation token
rather than by a user session: `JwtAuthGuard` reads the marker and delegates to
`InviteTokenGuard`. Do not report it as A1. It is how someone with no account
yet sets their first password, and the point of it is the same — `@Public()`
stays capped at three routes.

| ID   | Violation                                    | How to detect                                                        |
| ---- | -------------------------------------------- | -------------------------------------------------------------------- |
| A13  | `@InviteCredential()` outside the accept flow | the marker on anything but `GET /invitations/me` and `POST /invitations/accept` — every such route is reachable by whoever forwarded the invite email |
| A14  | `@Roles()` alongside `@InviteCredential()`    | both on one handler or its class: there is no `request.user`, so the `@Roles()` is dead and the route answers a blanket 403 |
| A15  | Invitation token read from the path           | a `:token` route param, or the token in a query string, on an invite route — a secret in a URL lands in access logs, browser history and `Referer` |

Rank A13 and A15 with the Critical group and A14 with High.

---

## Output format

```
# API Auth Audit — {N} controllers, {M} endpoints

## Critical (A1, A2, A9)
- `apps/backend/src/modules/apps/apps.controller.ts:34` — A1: `@Public()` on
  `GET /apps`. This exposes the full application list unauthenticated.

## High (A4, A6, A7)
- `apps/backend/src/modules/locales/locales.controller.ts:21` — A4: `POST /locales`
  has no `@Roles()`. Creating a locale is an admin operation per arch doc §5.

## Medium (A3, A5, A8)
- ...

## Endpoint coverage table
| Method | Path | Public | Auth | Roles | Rate-limited |
| ------ | ---- | ------ | ---- | ----- | ------------ |
| POST   | /auth/login | yes | — | — | yes |
| GET    | /apps       | no  | jwt | none declared | no |
| GET    | /v1/apps/:appSlug/locales/:localeCode | no | api-key | n/a | no |

## Summary
- Endpoints audited: N
- Unauthenticated endpoints: N (expected: 3)
- Service-credential endpoints: N
- Mutating endpoints with no role decision: N
```

---

## Rules

- Report only what you can point at with a file and line. Never infer a
  violation from a filename.
- Do not modify files. This agent reports; the fix is a separate change.
- Rank by blast radius: an unauthenticated read of CMS data outranks a missing
  `@Throttle()`.
- If `apps/backend/src/modules` has only the scaffold modules (`auth`, `users`,
  `health`), say so plainly rather than padding the report.
