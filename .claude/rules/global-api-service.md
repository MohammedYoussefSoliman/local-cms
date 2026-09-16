---
paths:
  - '**/services/use*.ts'
  - '**/modules/**/hooks/use*.ts'
---

# API Service Hook Pattern

This project uses **TanStack Query v5** with a shared `axiosInstance` for all API calls. Follow these rules strictly when creating or modifying service hooks. No exceptions.

---

## Naming Conventions

- `useGet*` — for read/query hooks (`useQuery`)
- `useLazyGet*` — for on-demand GET hooks triggered by user events (`useMutation`)
- `usePost*` or `useMutate*` or `useCreate*`/`useUpdate*`/`useDelete*` — for write/mutation hooks (`useMutation`)
- Hook name must describe the action and resource: `useGetAdmins`, `useLazyGetAdmin`, `useCreateAdmin`, `useUpdateAdmin`

---

## HTTP Client

**Always** use `axiosInstance` from `@/config` — never import axios directly, and never create a local axios instance.

```ts
// ✅
import { axiosInstance } from '@/config';
const res = await axiosInstance.get<HTTPResponseType<Thing>>('/things', {
  params,
});

// ❌
import axios from 'axios';
axios.get('/things');

// ❌ — do not create a local instance
const client = axios.create({ baseURL: '...' });
```

The single `axiosInstance` is configured in `src/config/axios.ts` with auth token injection, language headers, and global error interceptors. There is no per-service `baseUrl`.

---

## Query Keys

**Always** use module-prefixed query key constants — never use raw strings.

```ts
// ✅
import { TRANSLATIONS_QUERY_KEYS } from '@/helpers/queryKeys';
queryKey: [TRANSLATIONS_QUERY_KEYS.getEntries, params];

// ✅ — add a new group for a new module
export const CONFIGURATION_QUERY_KEYS = {
  getAllFaqs: 'getAllFaqs',
  getFaqById: 'getFaqById',
};

// ❌
queryKey: ['get-admins', params];
```

Each module uses its own prefixed constants object (e.g. `ADMIN_QUERY_KEYS`, `CONFIGURATION_QUERY_KEYS`). When adding a new hook, add its key to the appropriate group in `queryKeys.ts` first.

This applies to key **builder functions** too — if a module derives a key from a query object, the first element must still come from `queryKeys.ts`:

```ts
// ✅
export function getRolePermissionsQueryKey(query: RolePermissionsParams) {
  return [ROLES_QUERY_KEYS.getRolePermissions, Object.entries(query).join(',')];
}

// ❌ — raw string root; nothing else in the app can reliably invalidate this
export function getRolePermissionsQueryKey(query: RolePermissionsParams) {
  return ['rolePermissions', Object.entries(query).join(',')];
}
```

---

## Cache Invalidation Contract

This is the single most common source of "I saved the form but the table still shows old data" bugs. Every write mutation **must** invalidate every query key whose data it can change, and the invalidation must actually match those keys.

### Rule 1 — Invalidate with the key **root only**

`invalidateQueries` matches by **prefix**. List queries include their filters/pagination in the key, so passing the root alone invalidates every page and filter combination. Passing the filters too matches only the one cached variant the user happened to be looking at.

```ts
// query key in the useGet hook
queryKey: [THING_QUERY_KEYS.getAllThings, { page, limit, search }];

// ✅ — root only; invalidates every page/filter variant
queryClient.invalidateQueries({ queryKey: [THING_QUERY_KEYS.getAllThings] });

// ❌ — only matches this exact filter combination
queryClient.invalidateQueries({
  queryKey: [THING_QUERY_KEYS.getAllThings, currentFilters],
});

// ❌ — matches nothing at all when the live key carries a serialized query
queryClient.invalidateQueries({ queryKey: getThingsQueryKey({}) });
```

Do not pass `exact: true`. `exact: false` is the default and is what you want.

### Rule 2 — Invalidate the **same constant** the query hook uses

The invalidate key and the `useGet*` key must come from the same `QUERY_KEYS` constant. A raw string on either side is a silent no-op the moment the other side changes.

```ts
// ❌ — the real bug this rule exists for:
// useGetRoles  → queryKey: [ROLES_QUERY_KEYS.getAllRoles, filters]   // 'getAllRoles'
// useSaveRole  → invalidateQueries({ queryKey: ['roles'] })          // never matches
```

### Rule 3 — Invalidate **all** affected keys, not just the list

A create/update/delete typically touches more than one query. Enumerate them:

| Key                 | Invalidate when                                          |
| ------------------- | -------------------------------------------------------- |
| `getAll{Resource}s` | always — create, update, and delete                      |
| `get{Resource}ById` | update and delete (a stale detail view is still wrong)   |
| Cross-entity keys   | whenever the mutated entity appears inside another query |

Cross-entity is easy to miss. Examples in this repo:

- **Publishing a translation value** changes the entries table, that entry's
  history, and the module's missing-translation counts → invalidate
  `TRANSLATIONS_QUERY_KEYS.getEntries`, `.getValueHistory`, and
  `MODULES_QUERY_KEYS.getModuleById`
- **Enabling a locale on an app** changes `LOCALES_QUERY_KEYS.getAppLocales`
  _and_ every translation table, because the editor renders one column per
  enabled locale → invalidate `TRANSLATIONS_QUERY_KEYS.getEntries` too
- **Creating a module** changes `MODULES_QUERY_KEYS.getAllModules`, not
  `APPS_QUERY_KEYS.getAllApps`

Run them together:

```ts
onSuccess: async () => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [THING_QUERY_KEYS.getAllThings] }),
    queryClient.invalidateQueries({ queryKey: [THING_QUERY_KEYS.getThingById] }),
  ]);
  showToast({ status: 'success', variant: 'filled', title: t('savedSuccessfully') });
},
```

### Rule 4 — Invalidation lives in the hook, never at the call site

Components must not call `queryClient.invalidateQueries` after awaiting a mutation. When invalidation is split between the hook and the component, one of them inevitably drifts.

```tsx
// ❌ — in a table/dialog component
await mutateAsync(role.id);
await queryClient.invalidateQueries({
  queryKey: [ROLES_QUERY_KEYS.getRoleById],
});

// ✅ — useDeleteRole owns all of it; the component just calls the mutation
await mutateAsync(role.id);
```

If a component needs `useQueryClient` for anything other than a mutation's cache cleanup, that is fine — this rule is about invalidation after writes.

### Verification step

After writing or changing a mutation hook, grep the module for the query keys it should touch and confirm each one is invalidated:

```bash
grep -rn "queryKey:" apps/dashboard/src/modules/{module}/
```

Every `useQuery` key root in that output that the mutation can affect must appear in an `invalidateQueries` call in that mutation hook.

---

## Response Types

**Always** use `HTTPResponseType<T>` from `@cms/contracts` — never define a custom `{ data: T; code: string; status: number }` shape.

```ts
// ✅
import type { HTTPResponseType } from '@cms/contracts';

type ListAdminsResponse = HTTPResponseType<AdminsList>;
const res = await axiosInstance.get<HTTPResponseType<Admin>>('/admin/admins');

// ❌ — custom wrapper shape
type ApiResponse<T> = { data: T; code: string; status: number };
```

Note: The response interceptor in `axios.ts` already unwraps `response.data.data → response.data` for successful responses, so `queryFn` typically returns `res.data` directly.

---

## Error Handling

**Always** use `handleHttpError` from `@cms/ui` to extract the error message — never manually inspect `AxiosError` fields inline.

```ts
// ✅
import { handleHttpError, showToast } from '@cms/ui';

const { message } = handleHttpError(error, t('someThingWentWrong'));
showToast({ status: 'error', variant: 'filled', title: message });

// ❌ — manual inline extraction
if (error instanceof AxiosError) {
  const apiMessage =
    error?.response?.data?.errors?.[0]?.message ||
    error?.response?.data?.message;
  if (apiMessage) errorMessage = apiMessage;
}
```

`handleHttpError(error, fallback)` returns `{ message, fieldErrors }`. Use `message` for the toast title. Use `fieldErrors` when you need to map server-side validation errors onto form fields.

Error handling always goes in a `useEffect` watching the error — **never** in an `onError` callback.

---

## Query Hook Pattern (`useGet*`)

```ts
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { THING_QUERY_KEYS } from '@/helpers/queryKeys';
import { axiosInstance } from '@/config';
import type { HTTPResponseType } from '@cms/contracts';
import { handleHttpError, showToast } from '@cms/ui';

import { Thing, ThingParams } from '../Thing.types';

export function useGetThings(params: ThingParams) {
  const { t } = useTranslation('app');

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: [THING_QUERY_KEYS.getAllThings, params],
    queryFn: async () => {
      const res = await axiosInstance.get<HTTPResponseType<Thing[]>>(
        '/things',
        { params },
      );
      return res?.data;
    },
    placeholderData: (previous) => previous,
    throwOnError: false,
  });

  useEffect(() => {
    if (!error) return;
    const { message } = handleHttpError(error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [error, t]);

  return { data, isLoading, isFetching };
}
```

---

## Lazy GET Hook Pattern (`useLazyGet*`)

Use `useMutation` (not `useQuery`) when a GET request must be triggered on demand — e.g., from a user event, an `onChange` handler, or a button click. **Never** use `useQuery` with `enabled` toggling to approximate on-demand behavior.

```ts
import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { THING_QUERY_KEYS } from '@/helpers/queryKeys';
import { axiosInstance } from '@/config';
import type { HTTPResponseType } from '@cms/contracts';
import { handleHttpError, showToast } from '@cms/ui';

import { Thing } from '../Thing.types';

export function useLazyGetThing() {
  const { t } = useTranslation('app');

  const mutation = useMutation({
    mutationKey: [THING_QUERY_KEYS.getThingById],
    mutationFn: async (id: string) => {
      const res = await axiosInstance.get<HTTPResponseType<Thing>>(
        `/things/${id}`,
      );
      return res.data;
    },
  });

  useEffect(() => {
    if (!mutation.error) return;
    const { message } = handleHttpError(
      mutation.error,
      t('someThingWentWrong'),
    );
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [mutation.error, t]);

  return mutation;
}
```

### Lazy GET rules:

- Use `useMutation` — the `mutate` / `mutateAsync` call site drives the request, not a render-time flag
- **Never** use `useQuery` with `enabled: false` + manual toggling as a substitute
- No `onSuccess` toast is needed unless the feature explicitly calls for one — this pattern is for data fetching, not write operations
- Error handling goes in a `useEffect` watching `mutation.error`, same as write mutations
- The `mutationFn` parameter type must be explicit — no `any`

---

## Mutation Hook Pattern (`usePost*` / `useMutate*`)

```ts
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { THING_QUERY_KEYS } from '@/helpers/queryKeys';
import { axiosInstance } from '@/config';
import type { HTTPResponseType } from '@cms/contracts';
import { handleHttpError, showToast } from '@cms/ui';

import { Thing, CreateThingPayload } from '../Thing.types';

export function useCreateThing() {
  const { t } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: CreateThingPayload) => {
      const result = await axiosInstance.post<HTTPResponseType<Thing>>(
        '/things',
        payload,
      );
      return result.data;
    },
    onSuccess: async (res) => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: res?.message || t('savedSuccessfully'),
      });
      // Key roots only — see "Cache Invalidation Contract" above.
      // List every key this write can affect, including cross-entity ones.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [THING_QUERY_KEYS.getAllThings],
        }),
        queryClient.invalidateQueries({
          queryKey: [THING_QUERY_KEYS.getThingById],
        }),
      ]);
    },
  });

  useEffect(() => {
    if (!mutation.error) return;
    const { message } = handleHttpError(
      mutation.error,
      t('someThingWentWrong'),
    );
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [mutation.error, t]);

  return mutation;
}
```

### Mutation rules:

- `onSuccess` **must** call `queryClient.invalidateQueries` for **every** affected key + `showToast({ status: 'success', ... })` — see the Cache Invalidation Contract above
- Invalidate the key **root only** (no filters/pagination), using the same `QUERY_KEYS` constant the `useGet*` hook uses
- Error handling goes in a `useEffect` watching `mutation.error` — **do not use `onError` callback**
- Never use `any` for the mutation payload type

---

## `showToast` Signature

Always use the object form:

```ts
// ✅
showToast({
  status: 'success',
  variant: 'filled',
  title: res?.message || t('savedSuccessfully'),
});
showToast({ status: 'error', variant: 'filled', title: message });

// ❌ — old positional args form from other workspace
showToast('error', message, '');
```

---

## TypeScript Generics

- Queries: type the `axiosInstance.get<HTTPResponseType<T>>()` call explicitly
- Mutations: type the `mutationFn` parameter explicitly — no untyped `data: any`
- Never use `any` for payload — use `unknown` and narrow, or define a proper type

---

## File Placement

Each hook is a single file: `src/modules/{module}/services/use{Action}{Resource}.ts`

Do not put multiple hooks in one file. Do not put hooks in `src/services/` at the root level.
