# Skeleton Loading States

Every component and page that fetches data **must** ship a skeleton loading state. Skeletons are the default — not a follow-up task. A component without a matching skeleton is incomplete, the same way a component without locale strings is incomplete.

---

## Rule 1 — Skeletons mirror the real layout

A skeleton is not a generic grey box. It must reproduce the **exact structure, spacing, gap, and proportions** of the content it replaces — elements, rows, columns, card boundaries, dividers, and grouping.

```tsx
// ❌ — generic placeholder
if (isLoading) return <Skeleton className="h-80 w-full rounded-12" />;

// ✅ — mirrors the real card: title + 6 label/value rows + link
if (isLoading) {
  return (
    <div className="flex flex-col gap-3.5 rounded-12 border border-soft-light bg-white p-5">
      <Skeleton className="h-5 w-32 rounded-4" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-[150px] shrink-0 rounded-4" />
          <Skeleton className="h-3.5 w-24 rounded-4" />
        </div>
      ))}
      <Skeleton className="h-4 w-24 rounded-4" />
    </div>
  );
}
```

---

## Rule 2 — Skeleton height and width follow the element it replaces

Map each real element to a skeleton with matching dimensions:

| Real element | Skeleton sizing |
|---|---|
| Page/section title (`text-title-h5`, `text-label-lg`) | `h-5 w-{proportional}` |
| Body text (`text-paragraph-sm`) | `h-3.5 w-{proportional}` |
| Small label / caption (`text-paragraph-xs`, `text-label-xs`) | `h-3 w-{proportional}` |
| Headline number / stat (`text-3xl`, `text-label-xl`) | `h-8 w-{proportional}` |
| Avatar / icon circle | `size-{N} rounded-full` |
| Button | `h-9 w-{proportional} rounded-8` |
| Badge / chip / pill | `h-5 w-{proportional} rounded-full` |
| Table row | `h-10 w-full rounded-4` |
| Tab bar | `h-10 w-full rounded-4` |
| Divider | `h-px w-full rounded-4` |
| Progress bar | `h-2 w-full rounded-full` |
| Card wrapper | Use the card's actual border/bg/padding classes, fill with skeleton children |
| Info row (label + value) | Two side-by-side skeletons with the label's `w-` and the value's `w-` |

Width should be **proportional** to the expected content length — use fixed widths (`w-16`, `w-28`, `w-40`, `w-64`) not `w-full` for text-like elements. `w-full` is reserved for block containers and table rows.

---

## Rule 3 — Conditional/variant components use the most common variant

When a component renders different layouts based on data (e.g. subscription card shows different rows for trial vs. active vs. complimentary), the skeleton must use the **most common/representative variant's** dimensions:

- Pick the variant that appears most often in production
- If unknown, pick the variant with the **most elements** — this prevents layout shift (CLS) when real content swaps in, because the skeleton is at least as tall as any variant
- Never show multiple variant skeletons — pick one and commit

---

## Rule 4 — Page-level skeletons mirror the full page structure

A page skeleton is the composition of its child component skeletons. It must mirror:

1. The page header (avatar, title, meta, action buttons)
2. Navigation elements (store chips, tab bar, filter row)
3. Every card/section in the default view, with the correct column layout (`lg:flex-row` for side-by-side cards)
4. The maximum number of cards visible in the default tab/view

Do not show a skeleton for only the first card and omit the rest. The page skeleton shows the **full fold** of the default view.

---

## Rule 5 — Skeleton wrapper matches the real wrapper

If the real content is wrapped in a card (`rounded-12 border border-soft-light bg-white p-5`), the skeleton must use the same card wrapper — not a bare `<div>`. The card border, background, padding, and radius must be identical so the skeleton-to-content transition is seamless.

```tsx
// ❌ — skeleton floats without the card wrapper
if (isLoading) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-full rounded-4" />
    </div>
  );
}

// ✅ — same wrapper as the real card
if (isLoading) {
  return (
    <div className="flex flex-col gap-3.5 rounded-12 border border-soft-light bg-white p-5">
      <Skeleton className="h-5 w-32 rounded-4" />
      <Skeleton className="h-3.5 w-48 rounded-4" />
    </div>
  );
}
```

---

## Rule 6 — Use `Skeleton` from `@cms/ui`

Always import `Skeleton` from `@cms/ui`. Do not create custom pulse/shimmer components. The core `Skeleton` already applies `animate-pulse`, `bg-sub-light`, and accepts `className` for sizing overrides.

```tsx
import { Skeleton } from '@cms/ui';
```

---

## Rule 7 — Priority order for skeleton implementation

When building or auditing skeletons, prioritize by usage frequency and perceived-performance impact:

1. **List/table pages** — these are the primary navigation targets; a table skeleton prevents the entire page from feeling empty
2. **Cards with async data** — info cards, stats, summaries that appear on detail pages
3. **Form pages with pre-fill** — edit forms that `reset()` after data loads
4. **Modals/drawers with async content** — popovers that fetch on open
5. **Inline async sections** — tabs that lazy-load, accordion panels

---

## Rule 8 — RTL compliance

Skeleton layouts follow the same RTL rules as real content. Use logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) for any directional spacing. The skeleton structure mirrors automatically when using flex/grid, but any absolute positioning must use `start-`/`end-`, not `left-`/`right-`.

---

## Checklist for Every New Component/Page

1. Does the component fetch data (query hook, prop-based `isLoading`)? If yes, it needs a skeleton.
2. Does the skeleton reproduce the real layout's structure, spacing, and element proportions?
3. Does the skeleton wrapper match the real content's wrapper (card borders, padding, radius)?
4. For conditional/variant components, is the skeleton based on the most common variant?
5. For pages, does the skeleton show the full default view including all visible cards?
6. Does the skeleton use logical utilities for RTL compliance?
