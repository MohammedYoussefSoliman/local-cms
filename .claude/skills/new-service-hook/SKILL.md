---
name: new-service-hook
description: Scaffold a typed React Query service hook. Usage: /new-service-hook useGetAdmins [module] [app?]
---

# New Service Hook Scaffold

Scaffold a fully typed React Query service hook following the patterns in `.claude/rules/global-api-service.md`.

---

## Arguments

- **First argument** — hook name in camelCase starting with `use` (required). Examples: `useGetAdmins`, `useCreateAdmin`, `useUpdateAdmin`
- **Second argument** — module name (required). Example: `admins`, `configuration`, `rolesAndPermissions`
- **Third argument** — app name (optional, defaults to `dashboard`). Options: `dashboard`, `dashboard`, `dashboard`

If module or app is missing, ask before proceeding.

---

## Step 1: Determine hook type

- Hook starts with `useGet*` → **query hook** using `useQuery`
- Hook starts with `usePost*`, `useCreate*`, `useUpdate*`, `useDelete*`, or `useMutate*` → **mutation hook** using `useMutation`

If ambiguous, ask: "Is this a read (GET) or write (POST/PUT/PATCH/DELETE) operation?"

---

## Step 2: Determine endpoint

Ask the user:

1. What is the API endpoint path? (e.g. `/admin/admins`, `/admin/admins/:id`)

The `axiosInstance` is already configured with the base URL in `src/config/axios.ts` — no per-hook `baseUrl` needed.

---

## Step 2c: For mutation hooks — collect the invalidation set

**Do not skip this.** A mutation that invalidates the wrong key is indistinguishable from one that invalidates nothing: the form saves, the toast fires, and the table keeps showing stale rows.

List every query key the write can affect:

```bash
grep -rn "queryKey:" apps/{app}/src/modules/{module}/
```

From that output, build the invalidation set:

| Include                                         | When                                              |
| ----------------------------------------------- | ------------------------------------------------- |
| `{MODULE}_QUERY_KEYS.getAll{Resource}s`         | always                                            |
| `{MODULE}_QUERY_KEYS.get{Resource}ById`         | update / delete                                   |
| Any other key whose response embeds this entity | e.g. a permissions matrix whose columns are roles |

Two hard rules (full detail in `.claude/rules/global-api-service.md` → **Cache Invalidation Contract**):

1. Invalidate the **key root only**. `invalidateQueries` is prefix-matching, so `[KEYS.getAllThings]` covers every page and filter variant. Appending the current filters matches only the one variant on screen.
2. Use the **same constant** the `useGet*` hook uses. A raw string on either side (`['roles']` vs `[ROLES_QUERY_KEYS.getAllRoles]`) is a silent no-op.

If the module has no key builder for a query you need to invalidate — or its builder starts with a raw string — fix `queryKeys.ts` and the builder first, then write the mutation.

---

## Step 3: Create the hook file

**File path:** `apps/{app}/src/modules/{module}/services/{HookName}.ts`

### Query hook template (`useGet*`):

```ts
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { {MODULE}_QUERY_KEYS } from '@/helpers/queryKeys';
import { axiosInstance } from '@/config';
import { handleHttpError, HTTPResponseType, showToast } from '@cms/ui';

import { {Resource}List, {Resource}Params } from '../{Module}.types';

export function {HookName}(params: {Resource}Params) {
  const { t } = useTranslation('app');

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: [{MODULE}_QUERY_KEYS.getAll{Resource}s, params],
    queryFn: async () => {
      const res = await axiosInstance.get<HTTPResponseType<{Resource}List>>(
        '/{endpoint}',
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

### Mutation hook template (`usePost*` / `useCreate*` / `useUpdate*` / `useDelete*`):

```ts
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { {MODULE}_QUERY_KEYS } from '@/helpers/queryKeys';
import { axiosInstance } from '@/config';
import { handleHttpError, HTTPResponseType, showToast } from '@cms/ui';

import { {Resource}, Create{Resource}Payload } from '../{Module}.types';

export function {HookName}() {
  const { t } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: Create{Resource}Payload) => {
      const result = await axiosInstance.post<HTTPResponseType<{Resource}>>(
        '/{endpoint}',
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
      // Key roots only. Add every key from the Step 2c invalidation set,
      // including cross-entity ones.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [{MODULE}_QUERY_KEYS.getAll{Resource}s],
        }),
        queryClient.invalidateQueries({
          queryKey: [{MODULE}_QUERY_KEYS.get{Resource}ById],
        }),
      ]);
    },
  });

  useEffect(() => {
    if (!mutation.error) return;
    const { message } = handleHttpError(mutation.error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [mutation.error, t]);

  return mutation;
}
```

---

## Step 4: Update `queryKeys.ts`

Add the new key to `apps/{app}/src/helpers/queryKeys.ts` in the module's prefixed group. If the group doesn't exist yet, create it:

```ts
// Example: add to existing group or create new one
export const CONFIGURATION_QUERY_KEYS = {
  getAllFaqs: 'getAllFaqs',
  getFaqById: 'getFaqById', // ← new key
};
```

---

## Step 5: Add type stub (if needed)

If `{Resource}List`, `{Resource}`, or `Create{Resource}Payload` doesn't exist yet in `{Module}.types.ts`, add stubs:

```ts
import { HTTPResponseType } from '@cms/ui';

export type {Resource} = {
  id: string;
  // TODO: fill in fields
};

export type {Resource}List = {
  records: {Resource}[];
  meta: { page: number; limit: number; total: number; total_pages: number };
};

export type List{Resource}sResponse = HTTPResponseType<{Resource}List>;

export type Create{Resource}Payload = {
  // TODO: fill in payload fields
};
```

---

## Step 6: Verify invalidation (mutation hooks only)

Before reporting done, re-run the grep from Step 2c and check the result yourself:

```bash
grep -rn "queryKey:" apps/{app}/src/modules/{module}/
```

For every `useQuery` key root in that output that this mutation can change, confirm there is a matching `invalidateQueries` call in the new hook. Then confirm no component in the module invalidates on this mutation's behalf:

```bash
grep -rn "invalidateQueries" apps/{app}/src/modules/{module}/components/
```

Invalidation belongs in the hook. If a component is doing it after `await mutateAsync(...)`, move it into the hook and drop the now-unused `useQueryClient` import.

Report which keys the hook invalidates and why.

---

## After Scaffolding

1. Remind the user to fill in the type fields in `{Module}.types.ts`
2. Remind the user to add the corresponding translation keys via `/add-translation` if success/error messages are new
4. Do not add complexity beyond the minimum scaffold
