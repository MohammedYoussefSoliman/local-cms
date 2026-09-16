---
paths:
  - '**/store/*.ts'
---

# Zustand Store Pattern

All global Zustand stores follow a strict pattern. Use `apps/dashboard/src/store/auth-state.ts` as the canonical reference.

Module-level stores (scoped to a single feature module, e.g. `admins/stores/adminModalStore.ts`) are simpler — they use a bare `create()` without middleware.

---

## Global Stores (src/store/)

Every global store **must** be wrapped in both:

1. `devtools()` — for Redux DevTools debugging
2. `persist()` — for user-facing state that must survive page refresh

```ts
// ✅
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useThingStore = create<ThingStore>()(
  devtools(
    persist(
      (set) => ({ ... }),
      {
        name: 'cms-dashboard-thing-storage',
      },
    ),
    {
      name: 'Thing Store',
    },
  ),
);

// ❌ — missing devtools
export const useThingStore = create<ThingStore>()(
  persist((set) => ({ ... }), { name: 'thing' }),
);
```

For ephemeral/session-only global state (UI toggles that don't need to persist), you may omit `persist` but must keep `devtools`.

---

## Module-Level Stores (modules/{module}/stores/)

Feature modules can have their own Zustand stores for local UI state (modals, filters, selection). These do **not** need devtools or persist:

```ts
// ✅
import { create } from 'zustand';

export const useThingModalStore = create<ThingModalStore>()((set) => ({
  open: false,
  mode: 'create',
  openCreate: () => set({ open: true, mode: 'create' }),
  close: () => set({ open: false }),
}));
```

---

## Type Declaration

Declare a single `type StoreType` before `create<>()`. Separate state and actions sections:

```ts
type ThingStore = {
  // --- State ---
  items: Thing[];
  isLoading: boolean;
  // --- Actions ---
  setItems: (items: Thing[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  reset: () => void;
};
```

---

## No Business Logic in Stores

Stores are state containers only. Do NOT:

- Call API hooks from inside a store
- Run side effects inside setters (no `setTimeout`, no `fetch`)
- Derive computed values inside the store — derive them at the component level

```ts
// ❌ — business logic in store
setItems: (items) => {
  const filtered = items.filter(i => i.isActive); // ← derive at component level
  set({ items: filtered });
},

// ✅ — pure state update
setItems: (items) => set({ items }),
```

---

## Storage Key Naming

Global stores use the format `cms-{app}-{store-name}-storage`:

```ts
name: 'cms-dashboard-auth-storage', // in apps/dashboard
name: 'cms-dashboard-ui-storage';
```

### Never persist the access token

`persist` writes to `localStorage`, which is readable by any script on the
page. The short-lived access token stays in memory; only the refresh token and
the user survive a reload, via `partialize`:

```ts
persist(creator, {
  name: 'cms-dashboard-auth-storage',
  partialize: (state) => ({
    refreshToken: state.refreshToken,
    user: state.user,
  }),
});
```

Canonical reference: `apps/dashboard/src/store/auth-state.ts`.

---

## Hook Export Convention

Export the store hook as a named export starting with `use`:

```ts
export const useThingStore = create<ThingStore>()(...);
```

Then re-export from `src/store/index.ts` in sorted order.
