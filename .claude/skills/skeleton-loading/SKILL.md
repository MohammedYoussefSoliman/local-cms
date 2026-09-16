---
name: skeleton-loading
description: Generate or audit skeleton loading states for components and pages. Automatically invoked by /new-component, /new-module, and /refactor-module. Usage: /skeleton-loading [ComponentName|ModuleName] [app?]
---

# Skeleton Loading

Generate layout-accurate skeleton loading states for components and pages, or audit existing ones for accuracy. This skill enforces the rules in `.claude/rules/global-skeleton-loading.md`.

This skill is called automatically by `/new-component`, `/new-module`, and `/refactor-module`. It can also be invoked standalone to add or fix skeletons.

---

## Arguments

- **First argument** — component name OR module name (required)
- **Second argument** — app name (optional, defaults to `dashboard`)

If the name maps to a module directory under `apps/{app}/src/modules/`, run in **module mode**. Otherwise run in **component mode**.

---

## Component Mode

### Step 1: Read the component

Read the target component file. Identify:

- Does it accept an `isLoading` prop or call a query hook that returns `isLoading`?
- What is the rendered layout structure (wrapper, children, rows, columns)?
- Does it have conditional/variant rendering?

If the component has no loading path and fetches no data, report "No skeleton needed — component is synchronous" and stop.

### Step 2: Map the layout to skeleton elements

Walk the component's JSX tree and map each element to a skeleton:

| JSX element | Skeleton equivalent |
|---|---|
| Title/heading `<span>` or `<h*>` | `<Skeleton className="h-5 w-{proportional} rounded-4" />` |
| Body text `<span>` / `<p>` | `<Skeleton className="h-3.5 w-{proportional} rounded-4" />` |
| Small label | `<Skeleton className="h-3 w-{proportional} rounded-4" />` |
| Avatar | `<Skeleton className="size-{N} rounded-full" />` |
| Button | `<Skeleton className="h-9 w-{proportional} rounded-8" />` |
| Badge/Chip | `<Skeleton className="h-5 w-{proportional} rounded-full" />` |
| Icon | Skip — icons are too small to skeleton |
| Divider | `<Skeleton className="h-px w-full rounded-4" />` |
| Info row (label + value) | `<div className="flex items-center gap-{N}"><Skeleton ... /><Skeleton ... /></div>` |
| Table (N rows) | `{Array.from({ length: N }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-4" />)}` |
| Card wrapper | Keep the wrapper's classes (border, bg, padding, radius), fill with skeleton children |

**Width heuristics:**

- Short labels (1-2 words): `w-16` to `w-20`
- Medium labels (2-4 words): `w-24` to `w-32`
- Long labels / values: `w-36` to `w-48`
- IDs / long strings: `w-56` to `w-64`
- Use `shrink-0` on the label skeleton when the real label has a fixed width (`w-40 shrink-0`)

### Step 3: Handle conditional/variant rendering

If the component renders different layouts based on data:

1. List all variants and their element counts
2. Pick the **most common variant** (ask the user if unclear, otherwise pick the one with the most elements)
3. Build the skeleton from that variant only

### Step 4: Generate the skeleton code

Output the skeleton as a self-contained `if (isLoading)` block that goes at the top of the component's return, or as a dedicated `{ComponentName}Skeleton` function if the component receives `isLoading` as a prop.

**Pattern A — inline (component owns its query):**

```tsx
const { data, isLoading } = useGetSomething(id);

if (isLoading) {
  return (
    <div className="...same wrapper as real content...">
      {/* skeleton elements */}
    </div>
  );
}
```

**Pattern B — sibling function (component receives isLoading prop):**

```tsx
function {ComponentName}Skeleton() {
  return (
    <div className="...same wrapper as real content...">
      {/* skeleton elements */}
    </div>
  );
}

export function {ComponentName}({ data, isLoading }: Props) {
  if (isLoading) return <{ComponentName}Skeleton />;
  // ... real content
}
```

### Step 5: Insert the skeleton

Edit the component file to add the skeleton block. Do not modify the real content rendering.

---

## Module Mode

### Step 1: Locate the module

Path: `apps/{app}/src/modules/{Module}/`

If it doesn't exist, stop: "Module not found."

### Step 2: Inventory all components with loading states

Scan the module for:

1. **Pages** — files in `pages/` or `*Page.tsx` at module root
2. **Components** — files in `components/` that either:
   - Call a query hook (`useGet*`, `useQuery`)
   - Accept an `isLoading` prop
   - Have an existing `if (isLoading)` or `if (is*Loading)` block

Build a table:

```
| File | Has query? | Has isLoading prop? | Has skeleton? | Skeleton accurate? |
```

### Step 3: Prioritize by usage frequency

Sort the inventory by priority:

1. List/table pages (highest impact — primary navigation targets)
2. Cards with async data (info cards, stats, summaries on detail pages)
3. Form pages with pre-fill (edit forms that `reset()` after fetch)
4. Modals/drawers with async content
5. Inline async sections (lazy tabs, accordion panels)

### Step 4: Audit existing skeletons

For each file that already has a skeleton, compare it against the real rendered layout:

- **Structure match** — does the skeleton have the same nesting (flex-col, flex-row, grid)?
- **Element count** — does the skeleton have the same number of rows/items as the real content?
- **Wrapper match** — does the skeleton wrapper use the same card classes (border, bg, padding, radius)?
- **Proportion match** — do skeleton widths approximate the real content widths?
- **RTL compliance** — does the skeleton use logical utilities (no `ml-`, `mr-`, `left-`, `right-`)?

Flag issues:

- `MISSING` — component needs a skeleton but has none
- `GENERIC` — skeleton is a single block instead of mirroring the layout
- `STALE` — skeleton structure doesn't match the current real content (e.g. real content has 10 rows but skeleton shows 5)
- `RTL` — skeleton uses physical-direction utilities

### Step 5: Present findings

```
## Skeleton Audit — {Module} ({app})

| # | File | Priority | Status | Issue |
|---|------|----------|--------|-------|
| 1 | OrganizationViewPage.tsx | P1-page | ✅ Accurate | — |
| 2 | BillingBalanceCard.tsx | P2-card | ⚠️ Stale | 6 rows but real content has 7 |
| 3 | SyncOneOrderModal.tsx | P4-modal | ❌ Missing | No skeleton for async content |

### Auto-fixable
- BillingBalanceCard.tsx: update row count from 6 → 7
- SyncOneOrderModal.tsx: generate skeleton matching platform select + order input layout

Proceed? (y/n)
```

### Step 6: Apply fixes

After user confirms, generate or update skeletons for each flagged file using the same mapping logic as Component Mode.

---

## Rules

- Import `Skeleton` from `@cms/ui` — never create custom shimmer components.
- Skeleton wrappers must match real content wrappers exactly (card borders, bg, padding, radius).
- Use logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) — never physical direction.
- Width values must be proportional to expected content, not `w-full` for text elements.
- For repeated rows, use `Array.from({ length: N })` with the real content's row count.
- For conditional components, skeleton uses the most common variant's dimensions.
- Never modify the real content rendering — only add/update the skeleton block.
- Page skeletons show the full default view (all visible cards in the default tab).
