---
name: env-var
description: Add or manage an environment variable in the right place for the API (server-side, Zod-validated) or the dashboard (VITE_, client-exposed). Usage: /env-var JWT_ACCESS_TTL [api|dashboard]
---

# Environment Variable Management

This workspace has two env surfaces with opposite rules. Getting them mixed up
is how a secret ends up in a browser bundle.

| Package             | Prefix    | Reaches the browser? | Validated by                         |
| ------------------- | --------- | -------------------- | ------------------------------------ |
| `apps/backend`          | none      | **no**               | `src/config/env.validation.ts` (Zod) |
| `apps/dashboard`    | `VITE_`   | **yes, always**      | `src/vite-env.d.ts` (types only)      |

---

## Arguments

- `$1` — variable name (required)
- `$2` — `api` or `dashboard`. If omitted, infer from the prefix: a `VITE_`
  name is the dashboard, anything else is the API. Confirm if ambiguous.

---

## Rule 0 — Is it a secret?

A `VITE_` variable is **inlined into the JavaScript bundle at build time**. It
is public. Anyone who loads the dashboard can read it.

```
❌ VITE_JWT_SECRET         — now shipped to every browser
❌ VITE_DATABASE_PASSWORD  — same
✅ VITE_API_BASE_URL       — public by nature
```

If the value is a secret and the request is for the dashboard, stop and say
so. The answer is an API endpoint that uses the secret server-side, not a
prefixed variable.

---

## API variables (`apps/backend`)

### Step 1 — Add it to the Zod schema

`apps/backend/src/config/env.validation.ts` is the single source of truth. A
variable that is not in the schema is stripped and reads as `undefined`.

```ts
// apps/backend/src/config/env.validation.ts
const envSchema = z.object({
  // …
  ICU_VALIDATION_STRICT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
```

Choose the constraint deliberately — this is the point where a bad value is
caught. `z.string()` on something that must be a URL, a port, or a duration
buys nothing. Secrets get a `.min(32)`, the way the JWT secrets do.

### Step 2 — Add it to `.env.example` with a placeholder

```bash
# apps/backend/.env.example
ICU_VALIDATION_STRICT=false
```

Never a real secret. `.env.example` is committed; `.env` is not.

### Step 3 — Read it through `ConfigService`

```ts
// ✅
constructor(private readonly config: ConfigService) {}
const strict = this.config.getOrThrow<boolean>('ICU_VALIDATION_STRICT');

// ❌ — bypasses validation, and `audit-api-auth` flags it (A9)
const strict = process.env.ICU_VALIDATION_STRICT === 'true';
```

`process.env` is read only inside `apps/backend/src/config/`.

Use `getOrThrow` for anything required. `get` with a `??` fallback
re-introduces the default the schema already owns, in a second place.

---

## Dashboard variables (`apps/dashboard`)

### Step 1 — Add it to `.env.example`

```bash
# apps/dashboard/.env.example
VITE_ENABLE_STATE_DEVTOOLS=false
```

### Step 2 — Declare the type

`apps/dashboard/src/vite-env.d.ts`:

```ts
type ImportMetaEnv = {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_NODE_ENV: string;
  readonly VITE_ENABLE_STATE_DEVTOOLS: string; // ← add it here
};
```

Every `VITE_` value arrives as a **string**, including `"false"`, which is
truthy. Convert explicitly at the read site:

```ts
// ❌ — always true
if (import.meta.env.VITE_ENABLE_STATE_DEVTOOLS) { … }

// ✅
if (import.meta.env.VITE_ENABLE_STATE_DEVTOOLS === 'true') { … }
```

---

## Step 3 (both) — Tell the user what they must do by hand

Adding a variable to `.env.example` does not add it to anyone's `.env`, and
the API now refuses to boot without it if the schema made it required. Always
end by listing:

1. the line to add to their local `.env`
2. whether it needs to be added to the deployment secret manager
3. whether it is required (boot fails) or optional (has a default)

---

## Rules

- Never commit a real secret, in any file, including `.env.example`.
- Never add a variable to only one of the schema and `.env.example` — the pair
  is what makes a missing variable a clear boot error instead of a mystery.
- `.env` and `**/.env` are gitignored at the repo root. Verify with
  `git check-ignore -v apps/backend/.env` before writing anything sensitive.
