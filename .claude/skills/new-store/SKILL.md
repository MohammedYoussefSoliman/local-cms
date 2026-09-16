---
name: new-store
description: Scaffold a Zustand store with devtools + persist (global) or bare create (module-level). Usage: /new-store useCartStore [app-name]
---

# New Zustand Store Scaffold

Scaffold a typed Zustand store following `.claude/rules/global-zustand-store.md`. Use `apps/dashboard/src/store/auth-state.ts` as the canonical reference for global stores.

---

## Arguments

- **First argument** — store hook name starting with `use`, ending with `Store` (required). Examples: `useAdminModalStore`, `useFiltersStore`, `useAuthStore`
- **Second argument** — app name (optional, defaults to `dashboard`). Options: `dashboard`, `dashboard`, `dashboard`

If store name is missing, ask before proceeding.

---

## Before Creating

Ask the user:

1. What state does this store hold? (e.g. "modal open/closed, selected admin ID")
2. Is this a **global store** (in `src/store/`) or a **module-level store** (in `src/modules/{module}/stores/`)?
3. Does this state need to survive page refresh? (yes → keep `persist`; no → remove `persist`, keep `devtools` for global; bare `create` for module-level)
4. If global + persist: what is a short storage name? (e.g. `auth`, `ui`)

---

## File to Create

Derive `{StoreName}` = store name without `use` prefix and `Store` suffix (e.g. `useAdminModalStore` → `AdminModal`).

- **Global store**: `apps/{app}/src/store/{storeName}.ts`
- **Module-level store**: `apps/{app}/src/modules/{module}/stores/{storeName}.ts`

---

## Template: Global Store (with persist)

```ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type {StoreName}Store = {
  // --- State ---
  exampleValue: string;

  // --- Actions ---
  setExampleValue: (value: string) => void;
  reset: () => void;
};

const initialState = {
  exampleValue: '',
};

export const {hookName} = create<{StoreName}Store>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setExampleValue: (value) => set({ exampleValue: value }),
        reset: () => set(initialState),
      }),
      {
        name: 'cms-admin-{storage-name}-storage',
      },
    ),
    {
      name: '{StoreName} Store',
    },
  ),
);
```

Storage key format: `cms-{app}-{storage-name}-storage` (e.g. `cms-dashboard-auth-storage`, `cms-dashboard-ui-storage`).

Never persist an access token. Use `partialize` to keep it out of `localStorage` — see `.claude/rules/global-zustand-store.md`.

## Template: Global Store (no persist — ephemeral UI state)

```ts
export const {hookName} = create<{StoreName}Store>()(
  devtools(
    (set) => ({
      ...initialState,
      setExampleValue: (value) => set({ exampleValue: value }),
      reset: () => set(initialState),
    }),
    {
      name: '{StoreName} Store',
    },
  ),
);
```

## Template: Module-Level Store (bare — no middleware)

```ts
import { create } from 'zustand';

type {StoreName}State = {
  open: boolean;
  // TODO: add state fields
};

type {StoreName}Actions = {
  open: () => void;
  close: () => void;
  reset: () => void;
};

type {StoreName}Store = {StoreName}State & {StoreName}Actions;

const initialState: {StoreName}State = {
  open: false,
};

export const {hookName} = create<{StoreName}Store>()((set) => ({
  ...initialState,
  open: () => set({ open: true }),
  close: () => set({ open: false }),
  reset: () => set(initialState),
}));
```

---

## After Scaffolding

1. **Global store only**: Add the export to `apps/{app}/src/store/index.ts` in **sorted alphabetical order**:
   ```ts
   export * from './{storeName}';
   ```
2. **Module-level store**: Add the export to `apps/{app}/src/modules/{module}/stores/index.ts`
3. Remind the user to:
   - Replace `exampleValue` with actual state fields
   - Add all needed setters and a `reset()` action
   - Keep business logic OUT of the store — only state + setters
