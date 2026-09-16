---
name: new-module
description: Scaffold a complete feature module. Usage: /new-module admins [app-name]
---

# New Module Scaffold

Scaffold a complete feature module following the structure in `.claude/rules/dashboard-module-structure.md`. Use `apps/dashboard/src/modules/admins/` as the canonical reference.

---

## Arguments

- **First argument** — module name in camelCase or PascalCase (required). Examples: `configuration`, `rolesAndPermissions`, `admins`
- **Second argument** — app name (optional, defaults to `dashboard`). Options: `dashboard`, `dashboard`, `dashboard`

If the module name is missing, ask before proceeding.

---

## Before Creating Files

Ask the user:

1. What is the main entity this module manages? (e.g. "admins" → `Admin`)
2. What is the primary list endpoint? (e.g. `/admin/admins`)
3. What layout type should the routes use? (check the app's `AdminSassLayoutType` or equivalent enum)
4. Which write operations does this module need — create, update, delete? (scaffold a mutation hook for each; skip the mutation templates entirely if it is read-only)
5. **dashboard only** — is this module permission-gated? If yes, ask for its `PermissionCategories` value and its view permission key (e.g. `products.view`). Never invent a key: a wrong key hides the page _and_ its sidebar entry with no error. If the user does not know it, scaffold ungated and say so in the summary.

---

## Directory Structure to Create

```
apps/{app}/src/modules/{Module}/
  routes.tsx
  {Module}.types.ts
  pages/
    {Module}Page.tsx
  services/
    useGet{Module}.ts
    useCreate{Module}.ts     ← only if the module has a create/edit form
    useUpdate{Module}.ts     ← only if the module has a create/edit form
    useDelete{Module}.ts     ← only if the module has delete
  stores/
    .gitkeep
  components/
    .gitkeep
  locales/
    en.ts
    ar.ts
    index.ts
```

---

## File Templates

### `routes.tsx`

```tsx
import URLS from '@/helpers/urls';
import { AdminSassLayoutType, AdminSassModuleRoutes } from '@/types/common.types';

import {Module}Page from './pages/{Module}Page';

export const {module}Routes: AdminSassModuleRoutes[] = [
  {
    path: URLS.{module},
    layout: AdminSassLayoutType.NORMAL,
    element: <{Module}Page />,
  },
];
```

> Note: Check the app's `src/types/common.types.ts` for the correct route type and layout enum.

### `{Module}.types.ts`

```ts
import { HTTPResponseType } from '@cms/ui';

export type {Module}Item = {
  id: string;
  // TODO: add fields
};

export type {Module}List = {
  records: {Module}Item[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export type List{Module}Response = HTTPResponseType<{Module}List>;
export type Get{Module}Response = HTTPResponseType<{Module}Item>;

export type Create{Module}Payload = {
  // TODO: add payload fields
};
```

### `pages/{Module}Page.tsx`

```tsx
import { useTranslation } from 'react-i18next';

import { useGet{Module}s } from '../services/useGet{Module}s';

export function {Module}Page() {
  const { t } = useTranslation('app');
  const { data, isLoading } = useGet{Module}s({ page: 1, limit: 20 });

  if (isLoading) return <{Module}PageSkeleton />;

  return (
    <section className="flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-title-h5">{t('{module}Title')}</h1>
      </header>
      <{Module}Table records={data?.records ?? []} />
    </section>
  );
}
```

Named export, function declaration, no default export. Logical Tailwind
utilities only (`ps-`/`pe-`, `start-`/`end-`) — the dashboard ships Arabic.

### `services/useGet{Module}.ts`

```ts
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { {MODULE}_QUERY_KEYS } from '@/helpers/queryKeys';
import { axiosInstance } from '@/config';
import { handleHttpError, HTTPResponseType, showToast } from '@cms/ui';

import { {Module}List } from '../{Module}.types';

type {Module}Params = {
  page?: number;
  limit?: number;
};

export function useGet{Module}(params: {Module}Params = {}) {
  const { t } = useTranslation('app');

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: [{MODULE}_QUERY_KEYS.getAll{Module}s, params],
    queryFn: async () => {
      const res = await axiosInstance.get<HTTPResponseType<{Module}List>>(
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

### `services/useCreate{Module}.ts` — and the same shape for update / delete

Scaffold one file per write operation. **Every one of them must invalidate the queries it affects** — this is what keeps the table in sync after the form closes. See `.claude/rules/global-api-service.md` → **Cache Invalidation Contract**.

```ts
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { {MODULE}_QUERY_KEYS } from '@/helpers/queryKeys';
import { axiosInstance } from '@/config';
import { handleHttpError, HTTPResponseType, showToast } from '@cms/ui';

import { {Module}Item, Create{Module}Payload } from '../{Module}.types';

export function useCreate{Module}() {
  const { t } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: Create{Module}Payload) => {
      const res = await axiosInstance.post<HTTPResponseType<{Module}Item>>(
        '/{endpoint}',
        payload,
      );
      return res.data;
    },
    onSuccess: async (res) => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: res?.message || t('savedSuccessfully'),
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [{MODULE}_QUERY_KEYS.getAll{Module}s],
        }),
        queryClient.invalidateQueries({
          queryKey: [{MODULE}_QUERY_KEYS.get{Module}ById],
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

**Invalidation rules for the scaffold — get these right or the table will show stale rows:**

- Pass the **key root only**. `invalidateQueries` matches by prefix, so `[{MODULE}_QUERY_KEYS.getAll{Module}s]` covers every page and filter variant of the list. Never append the current filters or pagination.
- Use the **same constant** as the `useGet*` hook. Never invalidate a raw string.
- Include `get{Module}ById` on update and delete — a stale detail view is just as wrong as a stale table.
- Add any **cross-entity** key whose response embeds this entity (e.g. saving a role changes the columns of the permissions matrix).
- The invalidation lives in the hook. Components call `await mutateAsync(...)` and nothing else — they must not call `queryClient.invalidateQueries` themselves.

### `locales/en.ts`

```ts
import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'app', {
  {module}Title: '{Module}',
  // Add more translation keys here
});
```

### `locales/ar.ts`

```ts
import i18n from '@/locales/i18n';

i18n.addResourceBundle('ar', 'app', {
  {module}Title: '{Module} (AR)', // TODO: add correct Arabic translation
  // Add more translation keys here — must match en.ts exactly
});
```

### `locales/index.ts`

```ts
import './ar';
import './en';
```

---

## After Scaffolding

1. **Update `queryKeys.ts`**: Add a new prefixed group to `apps/{app}/src/helpers/queryKeys.ts`:

   ```ts
   export const {MODULE}_QUERY_KEYS = {
     getAll{Module}s: 'getAll{Module}s',
     get{Module}ById: 'get{Module}ById',
   };
   ```

   Add a key here for **every** query the module will run, including ones fetched by a key-builder function — mutations can only invalidate what they can name.

2. **Add URL**: Add `{module}: '/{module}'` to `apps/{app}/src/helpers/urls.ts`

3. **Register locales**: Add the module locale import to `apps/{app}/src/locales/index.ts` alongside the other module imports:

   ```ts
   import '@/modules/{module}/locales';
   ```

4. **Register routes**: Import and spread `{module}Routes` in `apps/{app}/src/modules/routes.ts`:

   ```ts
   import { {module}Routes } from './{module}/routes';

   export const routes: AdminSassModuleRoutes[] = [
     ...{module}Routes,
     // ... other routes
   ];
   ```

5. **Verify cache invalidation**. For every mutation hook scaffolded, run:

   ```bash
   grep -rn "queryKey:" apps/{app}/src/modules/{module}/
   ```

   Each `useQuery` key root in that output that a mutation can affect must appear in an `invalidateQueries` call inside that mutation hook. Then confirm no component is invalidating on a hook's behalf:

   ```bash
   grep -rn "invalidateQueries" apps/{app}/src/modules/{module}/components/
   ```

   That should return nothing. Report the invalidation set for each mutation hook.

6. **Register the sidebar entry** in `apps/{app}/src/layouts/AppSidebar/useSidebarNavItems.ts`.

8. **Skeleton loading** — generate a page-level skeleton for the module's main page following `.claude/rules/global-skeleton-loading.md`. The skeleton must mirror the page's real layout: header, navigation elements (tab bar, filter row), and all cards/sections visible in the default view. Run the `/skeleton-loading` skill logic inline — do not defer to a separate step. The skeleton goes in the `isLoading` branch, before the real layout renders.
9. Remind the user to fill in types, add page content, and translate Arabic strings
10. **If the module has delete functionality**, remind the user to use `ConfirmDeleteDialog` from `@/components` — see the "Delete Confirmation Dialog" section in `dashboard-module-structure.md` for the wrapper pattern. Never build a custom delete modal per-module.
11. **dashboard only** — report the module's gating status explicitly in the summary: the category and key used, or "ungated (no permission key supplied)". Never leave this ambiguous.
