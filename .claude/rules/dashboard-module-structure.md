---
paths:
  - 'apps/dashboard/src/modules/**'
---

# Dashboard Feature Module Structure

Every feature module in `apps/dashboard/src/modules/` follows this structure.
It is the frontend monorepo's module convention, minus the parts that belong
to that product (permission gating, `PageTemplate`).

---

## Required files

```
apps/dashboard/src/modules/{ModuleName}/
  routes.tsx               ← React Router route definitions
  {ModuleName}.types.ts    ← every type for this module
  pages/
    {ModuleName}Page.tsx
  services/                ← one React Query hook per file
    useGet{ModuleName}.ts
  components/              ← module-specific UI
  stores/                  ← module-level Zustand stores (optional)
  locales/
    en.ts
    ar.ts
    index.ts
```

---

## Routes

Export a named const, import `URLS` from `@/helpers`:

```tsx
import { URLS } from '@/helpers';

import { AppsPage } from './pages/AppsPage';

export const appsRoutes: RouteObject[] = [
  { path: URLS.apps, element: <AppsPage /> },
];
```

Never hard-code a path string in a route or a `navigate()` call. `URLS` is the
only place a route shape is written down, which is what makes renaming one
safe.

---

## Types

- All module types live in `{ModuleName}.types.ts` — never scattered across
  component files.
- API response types use `HTTPResponseType<T>` from `@cms/contracts`.
- Suffixes: `Response`, `Payload`, `Params`, `Props`. See
  `.claude/rules/global-typescript-conventions.md`.
- Types that the API also needs belong in `@cms/contracts`, not here.

---

## Services

One hook per file, following `.claude/rules/global-api-service.md`. When adding
a hook, add its key to the module's group in `src/helpers/queryKeys.ts` **in
the same commit** — a hook with a raw string key is a cache bug that surfaces
weeks later as "the table doesn't refresh".

---

## Locales

`en.ts` and `ar.ts` are updated together, always, with matching keys.

```ts
// en.ts
import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'app', { appsTitle: 'Applications' });
```

A key in one file and not the other renders blank for those users — silently,
with no error anywhere.

> The dashboard's own chrome is translated from these bundled files, **not**
> from the CMS API. Bootstrapping the CMS UI from the CMS would make the login
> screen unrenderable whenever the API is down.

---

## Inter-module rules

- Modules never import from other modules.
- Shared UI goes to `@cms/ui`; shared types go to `@cms/contracts` or
  `@cms/domain`.
- A component gets promoted to `@cms/ui` on its **second** consumer, not in
  anticipation of one.

---

## Translation-editor specifics

The translation table renders **one column per enabled locale**, built from
`app_locales` at runtime. Two consequences:

- Never hard-code two columns, or an `ar`/`en` pair, anywhere in the editor.
  Enabling French must change nothing but data.
- Column definitions depend on the locale list *and* `i18n.language`; list
  both in the `useMemo` deps.

```tsx
// ❌ — the CMS's own UI now needs a code change to support a new language
const columns = [keyColumn, arabicColumn, englishColumn];

// ✅
const columns = useMemo(
  () => [keyColumn, ...locales.map(localeColumn)],
  [locales, t, i18n.language],
);
```
