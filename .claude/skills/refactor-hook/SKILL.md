---
name: refactor-hook
description: Fixes a service hook file to comply with the api-service rule. Applies violation fixes in place and updates queryKeys.ts and .types.ts as needed. Usage: /refactor-hook useGetAdmins admins [app]
---

# Refactor Service Hook

Fix a service hook file so it fully complies with `.claude/rules/global-api-service.md`. Reads the file, identifies all violations, and applies targeted fixes without touching anything else.

---

## Arguments

- **First argument** — hook name (required). Example: `useGetAdmins`, `useCreateAdmin`
- **Second argument** — module name (required). Example: `admins`, `configuration`
- **Third argument** — app name (optional, defaults to `dashboard`)

If hook name or module is missing, ask before proceeding.

---

## Step 1: Locate and Read Files

**Hook file path:** `apps/{app}/src/modules/{module}/services/{HookName}.ts`

Some older modules put service hooks in `hooks/` instead of `services/` (e.g. `rolesAndPermissions`, `dashboard/products`). If the path above doesn't exist, try `apps/{app}/src/modules/{module}/hooks/{HookName}.ts` before giving up.

Also read:

- `apps/{app}/src/modules/{module}/{Module}.types.ts` — to understand existing types
- `apps/{app}/src/helpers/queryKeys.ts` — to understand existing keys and format
- **Every sibling query hook in the module** — you cannot audit a mutation's invalidation without knowing the actual live query keys:

  ```bash
  grep -rn "queryKey:" apps/{app}/src/modules/{module}/
  ```

If the hook file doesn't exist, stop: "File not found: {path}. Check the hook name and module."

---

## Step 2: Audit the Hook

Check for each violation:

| Code | Check                                                         | How to detect                                                        |
| ---- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| V1   | Direct `import axios from 'axios'`                            | Present in imports                                                   |
| V2   | Raw string query key                                          | `queryKey:` array contains a string literal, not `*_QUERY_KEYS.`     |
| V3   | Mutation missing error useEffect                              | File has `useMutation` but no `useEffect` watching `mutation.error`  |
| V4   | Mutation `onSuccess` missing `invalidateQueries`              | Has `onSuccess:` but no `invalidateQueries` call                     |
| V5   | Mutation `onSuccess` missing `showToast`                      | Has `onSuccess:` but no `showToast` call                             |
| V6   | Mutation payload typed as `any`                               | `mutationFn: async (data: any)` pattern                              |
| V7   | Uses custom response wrapper instead of `HTTPResponseType<T>` | Response type doesn't use `HTTPResponseType` from `@cms/ui`       |
| V8   | Invalidation key matches no live query key                    | See below — this is the silent stale-table bug                       |
| V9   | Invalidation key is over-specific (filters/pagination)        | `invalidateQueries` key array has more than the key root             |
| V10  | Incomplete invalidation set                                   | An affected query key root is never invalidated                      |
| V11  | Component invalidates on this hook's behalf                   | `invalidateQueries` appears in the module's `components/`            |

Is it a mutation hook? A file is a mutation if it imports `useMutation`. V3–V6 and V8–V11 apply to mutations only.


### Auditing V8 — invalidation key matches nothing

`invalidateQueries` matches by **prefix** and fails **silently**: a key that matches nothing produces no error, no warning, and no refetch. The mutation succeeds, the toast fires, and the table keeps showing stale rows. This is the most common cause of "I added a record but the table didn't update".

Compare the first element of each `invalidateQueries` key against the first element of every `queryKey` in the module:

```ts
// useGetRoles  → queryKey: [ROLES_QUERY_KEYS.getAllRoles, filters]   // 'getAllRoles'
// useSaveRole  → invalidateQueries({ queryKey: ['roles'] })          // ❌ V8 — matches nothing
```

Watch for key **builder functions** too — a builder that returns `['rolePermissions', serializedQuery]` is not invalidated by `getRolePermissionsQueryKey({})`, which returns `['rolePermissions', '']` and only prefix-matches queries whose second element is exactly `''`.

### Auditing V9 — over-specific key

```ts
// ✅ root only — covers every page and filter variant
invalidateQueries({ queryKey: [THING_QUERY_KEYS.getAllThings] });

// ❌ V9 — only the one filter combination currently on screen refetches
invalidateQueries({ queryKey: [THING_QUERY_KEYS.getAllThings, filters] });
```

`exact: false` is the default; passing it explicitly is harmless but redundant. Passing `exact: true` is always a violation.

### Auditing V10 — incomplete set

From the module-wide `queryKey:` grep, every key root this mutation can affect must be invalidated:

- `getAll{Resource}s` — always
- `get{Resource}ById` — on update and delete
- Cross-entity keys — any query whose response embeds this entity (e.g. saving a role changes the columns of the permissions matrix, so `getRolePermissions` must be invalidated too)

---

## Step 3: Report Findings

Before making any changes, list what will be fixed:

```
## Refactor Plan — {HookName}.ts

Found N violation(s):
- V2: Raw query key string 'get-admins' → will add ADMIN_QUERY_KEYS.getAllAdmins and reference it
- V3: Missing error useEffect → will add useEffect watching mutation.error with showToast
- V5: Missing showToast in onSuccess → will add showToast({ status: 'success', ... })

- V8: invalidateQueries(['roles']) matches no live query key (useGetRoles uses
      ROLES_QUERY_KEYS.getAllRoles) → the table never refetches after save
- V10: getRolePermissions is affected (roles are its columns) but never invalidated

No violations: V1, V4, V6, V7, V9, V11
Not applicable: V12–V15 (not dashboard)

Proceed? (yes to apply all fixes)
```

For mutation hooks, always include the invalidation audit in the plan — even when it is clean:

```
Invalidation audit — live query key roots in this module:
  getAllRoles       → ✅ invalidated
  getRoleById       → ✅ invalidated
  rolePermissions   → ❌ affected but missing (V10)
  getAllPermissions → n/a (unaffected by this write)
```

Wait for confirmation before editing.

---

## Step 4: Apply Fixes

Apply each fix precisely. Do not rewrite the entire file — make targeted edits only.

### V1 Fix — Replace direct axios import

```ts
// Remove:
import axios from 'axios';

// Add to imports (if not already present):
import { axiosInstance } from '@/config';

// Replace axios calls:
axios.get('/endpoint') → axiosInstance.get<HTTPResponseType<Thing>>('/endpoint')
```

### V2 Fix — Replace raw query key string

1. Identify the raw string being used (e.g. `'get-admins'`)
2. Derive a camelCase key name (e.g. `getAllAdmins`)
3. Find or create the module-prefixed group in `queryKeys.ts` (e.g. `ADMIN_QUERY_KEYS`)
4. Check if `ADMIN_QUERY_KEYS.getAllAdmins` already exists
5. If not: add `getAllAdmins: 'getAllAdmins'` to the group
6. Add the import to the hook if missing
7. Replace the raw string with `ADMIN_QUERY_KEYS.getAllAdmins`

### V3 Fix — Add missing error useEffect

Add after the `useMutation` call:

```ts
useEffect(() => {
  if (!mutation.error) return;
  const { message } = handleHttpError(mutation.error, t('someThingWentWrong'));
  showToast({ status: 'error', variant: 'filled', title: message });
}, [mutation.error, t]);
```

Also add missing imports: `useEffect` from `react`, `handleHttpError, showToast` from `@cms/ui`, `useTranslation` from `react-i18next`. If the hook currently handles errors in an `onError` callback, delete that callback — the rule requires the `useEffect` form.

### V4 / V8 / V9 / V10 Fix — Correct the invalidation set

All four are fixed the same way: replace whatever is there with the full, correctly-rooted set derived from the module-wide `queryKey:` grep in Step 1.

```ts
onSuccess: async (res) => {
  showToast({
    status: 'success',
    variant: 'filled',
    title: res?.message || t('savedSuccessfully'),
  });
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [{MODULE}_QUERY_KEYS.getAll{Resource}s],
    }),
    queryClient.invalidateQueries({
      queryKey: [{MODULE}_QUERY_KEYS.get{Resource}ById],
    }),
    // ...one entry per cross-entity key this write affects
  ]);
},
```

Also add `const queryClient = useQueryClient();` and `import { useQueryClient } from '@tanstack/react-query';` if missing.

If a key you need to invalidate has no constant in `queryKeys.ts` — typically because a builder function hardcodes a raw string root — add the constant first, keeping the **same string value** so existing cached keys still match, then point the builder at it:

```ts
// queryKeys.ts
export const ROLES_QUERY_KEYS = {
  getAllRoles: 'getAllRoles',
  getRoleById: 'getRoleById',
  getRolePermissions: 'rolePermissions', // same value the builder used
};

// the builder
export function getRolePermissionsQueryKey(query: RolePermissionsParams) {
  return [ROLES_QUERY_KEYS.getRolePermissions, Object.entries(query).join(',')];
}
```

Never guess a key. If you genuinely cannot determine whether a query is affected, invalidate it — an extra refetch is cheap; a stale table is a bug.

### V11 Fix — Move component-side invalidation into the hook

```bash
grep -rn "invalidateQueries" apps/{app}/src/modules/{module}/components/
```

For each hit that follows an `await mutateAsync(...)`: delete it, fold its key into the hook's invalidation set, and remove the now-unused `useQueryClient` import and `const queryClient = ...` line from the component.

```tsx
// ❌ before — in RolesTable.tsx
await mutateAsync(role.id);
await queryClient.invalidateQueries({
  queryKey: [ROLES_QUERY_KEYS.getRoleById],
});

// ✅ after — useDeleteRole owns it
await mutateAsync(role.id);
```

### V5 Fix — Add missing `showToast` in `onSuccess`

Add inside the `onSuccess` handler:

```ts
showToast({
  status: 'success',
  variant: 'filled',
  title: res?.message || t('savedSuccessfully'),
});
```

### V6 Fix — Replace `any` payload type

1. Identify the payload parameter (e.g. `data: any`)
2. Look in `{Module}.types.ts` for an existing payload type
3. If a suitable type exists: use it
4. If not: add a stub type to `{Module}.types.ts`:
   ```ts
   export type {Resource}Payload = {
     // TODO: fill in payload fields
   };
   ```
5. Replace `data: any` with `data: {Resource}Payload`
6. Add the import to the hook file

### V7 Fix — Replace custom response wrapper

```ts
// Remove custom wrapper import/definition
// Add:
import { HTTPResponseType } from '@cms/ui';

// Replace response type:
axiosInstance.get<HTTPResponseType<Thing>>('/endpoint');
```

## Step 5: Report What Was Fixed

After editing:

```
## Refactor Complete — {HookName}.ts

✅ Fixed:
- V2: Added ADMIN_QUERY_KEYS.getAllAdmins to queryKeys.ts, updated queryKey reference
- V3: Added error useEffect with showToast
- V5: Added showToast({ status: 'success', ... }) in onSuccess

Files modified:
- apps/{app}/src/modules/{module}/services/{HookName}.ts
- apps/{app}/src/helpers/queryKeys.ts (if V2 fix applied)
- apps/{app}/src/modules/{module}/{Module}.types.ts (if V6 fix applied)

⚠️  TODOs left for you:
- Verify the invalidation key in onSuccess is correct
- Add Arabic translation for new keys via /add-translation
```

---

## Rules

- Never change the API endpoint path — only fix the structural pattern.
- Never rename the hook — only fix its implementation.
- Never rewrite the entire file — surgical edits only.
- V14 is the one fix that changes the hook signature — update every call site in the same pass, or don't apply it.
- If a fix requires a new translation key, flag it and suggest the `/add-translation` command.
