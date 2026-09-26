---
paths:
  - '**/*.types.ts'
  - '**/types/*.ts'
  - '**/services/use*.ts'
---

# TypeScript Conventions

These conventions apply across all apps in the monorepo. They are stricter in service hooks and types files.

---

## `type` vs `interface`

Use `type` by default. Use `interface` only when extending another type or interface.

```ts
// ✅ — plain object shape
type Order = {
  id: string;
  status: string;
};

// ✅ — extending
interface OrderWithMeta extends Order {
  meta: Record<string, string>;
}

// ❌ — interface for plain object shape
interface Order {
  id: string;
}
```

---

## Localized values are keyed by locale CODE, never by a language union

This repo's whole reason for existing is that languages are data. A type that
enumerates them at compile time — `Record<'ar' | 'en', string>` — puts French
behind a TypeScript change as well as a migration, which is exactly the
coupling §4 of the architecture doc removes.

```ts
// ❌ — a compile-time language union; adding `fr` breaks every call site
type Entry = { values: Record<'ar' | 'en', string> };

// ❌ — claims every locale is always present with a string value
type Entry = { values: Record<string, string> };

// ✅ — open set of locale codes, and a locale may genuinely have no value yet
import type { TranslationRow } from '@cms/contracts';
type Entry = TranslationRow;
//   values: Record<string, { value: string; status; version } | null>
```

The `| null` is load-bearing: "this key has no Arabic yet" is the normal state
of a translation table, not an error, and the dashboard renders it as a
missing-translation cell. Reading `values[code].value` without the guard is the
crash this type exists to prevent.

It is `null` rather than `undefined` because the value crosses the wire.
`JSON.stringify` drops an `undefined` property entirely, so the language with
no translation — the one case the editor most needs a column for — would simply
not appear in the response.

The bootstrap constant `BOOTSTRAP_LOCALES` in `@cms/domain` seeds the
`locales` table. It is **not** a type source — never derive a key union from it.

Full rules: `.claude/rules/cms-domain-invariants.md`.

---

## Naming Conventions

| Pattern                    | Suffix     | Example                                |
| -------------------------- | ---------- | -------------------------------------- |
| API response               | `Response` | `ListAdminsResponse`                   |
| API payload / request body | `Payload`  | `CreateAdminPayload`                   |
| Query params               | `Params`   | `AdminsParams`                         |
| Component props            | `Props`    | `AdminCardProps`                       |
| Store type                 | `Store`    | `UiStore`                              |
| Enum-like union            | no suffix  | `AdminStatus = 'active' \| 'inactive'` |

---

## No `any` in Service Hooks

Service hooks must not use `any` for API response or payload types.

```ts
// ✅
mutationFn: async (data: CreateAdminPayload) =>
  axiosInstance.post<HTTPResponseType<Admin>>('/admin/admins', data);

// ❌
mutationFn: async (data: any) => axiosInstance.post('/admin/admins', data);
```

For Axios error objects (which are hard to type fully), a scoped `any` with a comment is acceptable:

```ts
useEffect(() => {
  const error = mutation.error;
  if (!error) return;
  let errorMessage = t('someThingWentWrong');
  if (error instanceof AxiosError) {
    const apiMessage =
      error.response?.data?.errors?.[0]?.message ||
      error.response?.data?.message;
    if (apiMessage) errorMessage = apiMessage;
  }
  showToast({ status: 'error', variant: 'filled', title: errorMessage });
}, [mutation.error, t]);
```

---

## API Response Wrapper

Always use `HTTPResponseType<T>` from `@cms/contracts` for API responses — never define a custom wrapper shape:

```ts
// ✅
import { HTTPResponseType } from '@cms/contracts';

export type ListAdminsResponse = HTTPResponseType<AdminsList>;
export type GetAdminResponse = HTTPResponseType<Admin>;

// ❌ — custom wrapper shape
export type ApiResponse<T> = { data: T; code: string; status: number };
```

---

## Import Order

Imports must follow the ESLint-enforced order (enforced by `@cms/linting`):

1. Built-in (Node)
2. External packages
3. Internal `@cms/*`
4. Internal `@/*` path aliases (by group: layouts → components → hooks → providers → config → services → helpers → store → types → modules → utils)
5. Parent (`../`)
6. Sibling (`./`)
7. Type imports last within each group

---

## Exports

- Named exports only — no default exports in types files or service hooks
- `index.ts` barrel files must export in **sorted alphabetical order** (enforced by ESLint)
