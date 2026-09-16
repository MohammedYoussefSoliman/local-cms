---
name: refactor-component
description: Applies react-components, react-useeffect, rtl-direction and localized-data fixes to a component file. Converts default exports, arrow function components, inline JSX handlers, inline styles, misplaced types, Tailwind arbitrary values (`text-[14px]`, `py-[82px]`), physical-direction (LTR-only) Tailwind utilities and raw localized reads (`name[i18n.language]`). Usage: /refactor-component ComponentName [path/to/Component.tsx]
---

# Refactor Component

Fix a component file so it complies with `.claude/rules/global-react-components.md`, `.claude/rules/global-react-useeffect.md`, `.claude/rules/global-rtl-direction.md` and `.claude/rules/cms-domain-invariants.md`. Reads the file, identifies violations, confirms with the user, then applies surgical fixes.

---

## Arguments

- **First argument** — component name in PascalCase (required). Example: `OrderCard`, `ProductTable`
- **Second argument** — path to the source `.tsx` file (optional). If not provided, search for it.

If path is not provided, glob for `**/{ComponentName}.tsx` and `**/{ComponentName}/{ComponentName}.tsx` and ask the user to confirm which file.

---

## Step 1: Read the Component File

Read the full source file. Also check if `{ComponentName}.types.ts` exists alongside it (read it too if so).

---

## Step 2: Audit for Violations

Check each rule:

### From `global-react-components.md`

| Code | Violation                      | How to detect                                                                                                                 |
| ---- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| C1   | Default export                 | `export default function` or `export default {ComponentName}` at bottom                                                       |
| C2   | Arrow function component       | `const {ComponentName} = () =>` or `const {ComponentName} = ({...}) =>` at top level                                          |
| C3   | Inline arrow in JSX event prop | `onClick={() =>`, `onChange={(e) =>`, `onSubmit={(e) =>` inside JSX                                                           |
| C4   | Inline styles                  | `style={{` in JSX                                                                                                             |
| C5   | Types defined inside `.tsx`    | `type {ComponentName}Props` or `interface {ComponentName}Props` in the `.tsx` file (when a `.types.ts` file should hold them) |
| C6   | `import React from 'react'`    | The old default import style                                                                                                  |
| C7   | Tailwind arbitrary value       | Any class containing brackets: `grep -nE '(^\|[^a-zA-Z])[a-z-]+-\[[^]]+\]'` — or `!` on a sizing utility                      |

### From `global-react-useeffect.md`

| Code | Violation                                            | How to detect                                                                                 |
| ---- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| U1   | `useEffect` used to sync state from props            | Pattern: `useEffect(() => { setX(prop.x) }, [prop.x])`                                        |
| U2   | `useEffect` used for event-specific logic            | Pattern: effect body contains logic that should be in a handler (e.g. form validation, toast) |
| U3   | `useEffect` with no cleanup for subscriptions/timers | `setInterval`, `addEventListener`, `setTimeout` inside effect without cleanup function        |

### From `global-rtl-direction.md`

Every app ships Arabic and `dir` is set on `<html>`, so these are real rendering bugs, not hygiene.

| Code | Violation                            | How to detect                                                                                         |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| D1   | Physical margin/padding              | `ml-`, `mr-`, `pl-`, `pr-` in a `className`                                                           |
| D2   | Physical inset on positioned element | `left-`, `right-` alongside `absolute` / `fixed` / `sticky`                                           |
| D3   | Physical text alignment              | `text-left`, `text-right`                                                                             |
| D4   | Physical border / radius side        | `border-l-`, `border-r-`, `rounded-l-`, `rounded-r-`, `rounded-t{l,r}-`, `rounded-b{l,r}-`            |
| D5   | Unmirrored directional icon          | `ChevronLeft/Right`, `ArrowLeft/Right`, `CornerUpLeft`, `Undo/Redo` in JSX without `rtl:-scale-x-100` |
| D6   | Double-mirroring                     | `rtl:flex-row-reverse`, `rtl:flex-col-reverse` — flex already mirrors                                 |
| D7   | Un-isolated technical string         | A phone / email / URL / id / JSON / timestamp value rendered without `dir="ltr"`                      |

### From `cms-domain-invariants.md`

Localized API fields (`{ en, ar }`) arrive `null` more often than the types admit, and a raw index takes down the whole route.

| Code | Violation                                      | How to detect                                                                               |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| L1   | Unguarded localized index                      | `x.field[i18n.language]` with no `?.` — **Critical**, throws on `null`                      |
| L2   | Guarded index / hand-rolled fallback chain     | `x.field?.[i18n.language] ?? x.field?.en ?? ''`                                             |
| L4   | Localized field typed `Record<string, string>` | in the sibling `.types.ts`                                                                  |
| L5   | `useMemo` over localized data missing a dep    | deps list `t` but not `i18n.language`                                                       |
| L7   | `getLocalizedText` on a write path             | inside `form.reset` / `defaultValues` / a mutation payload — **Critical**, drops a language |

---

## Step 3: Report Findings

Before making any changes:

```
## Refactor Plan — {ComponentName}.tsx

Found N violation(s):

### Will Fix Automatically
- C1: Default export → will convert to named export function
- C3: 2 inline arrow handlers → will extract to handleClick, handleChange
- C5: Props type defined in .tsx → will move to {ComponentName}.types.ts

### Needs Your Guidance
- C4: Inline style `style={{ marginTop: '8px' }}` → unclear Tailwind equivalent
  Options: `mt-2` (8px = 0.5rem) | keep and add TODO comment

### Cannot Auto-Fix (will flag with TODO comment)
- U1: useEffect syncing state from props on line 47 — requires design decision

Proceed with auto-fixable changes?
(and confirm: C4 → use mt-2 or keep with TODO?)
```

Wait for confirmation before editing.

---

## Step 4: Apply Fixes

Apply each confirmed fix precisely. Make minimal changes — preserve all logic and structure.

### C1 Fix — Convert default export to named export

```tsx
// Before:
export default function OrderCard({ ... }) { ... }
// or:
const OrderCard = () => { ... }
export default OrderCard;

// After:
export function OrderCard({ ... }) { ... }
```

Also update the `index.ts` barrel: replace `export { default as OrderCard }` with `export * from './OrderCard'` if needed.

### C2 Fix — Convert arrow function to function declaration

```tsx
// Before:
const OrderCard = ({ id, status }: OrderCardProps) => {
  return <div>...</div>;
};

// After:
export function OrderCard({ id, status }: OrderCardProps) {
  return <div>...</div>;
}
```

Exception: keep arrow function if it's wrapped in `memo`.

### C3 Fix — Extract inline arrow handlers

```tsx
// Before:
<button onClick={() => handleDelete(id)}>Delete</button>
<input onChange={(e) => setSearch(e.target.value)} />

// After:
function handleDeleteClick() {
  handleDelete(id);
}
function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
  setSearch(e.target.value);
}
...
<button onClick={handleDeleteClick}>Delete</button>
<input onChange={handleSearchChange} />
```

Name handlers `handle{EventSource}{EventType}` (e.g. `handleDeleteClick`, `handleSearchChange`).

### C4 Fix — Convert inline styles to Tailwind classes

Only convert when the mapping is unambiguous:

```tsx
// Before:
<div style={{ marginTop: '8px', color: 'red', display: 'flex' }}>

// After (if mapping is clear):
<div className={cn('mt-2 text-red-500 flex')}>
```

If the mapping is unclear, add a comment and skip:

```tsx
<div style={{ /* TODO: convert to Tailwind */ marginTop: '12px' }}>
```

### C5 Fix — Move types to `{ComponentName}.types.ts`

1. Extract the props type/interface from the `.tsx` file
2. Add it to `{ComponentName}.types.ts` (create the file if it doesn't exist)
3. Add `export * from './{ComponentName}.types'` to `index.ts` if not already there
4. Replace the inline type with an import in the `.tsx` file:
   ```tsx
   import type { OrderCardProps } from './OrderCard.types';
   ```

### C6 Fix — Fix React import

```tsx
// Before:
import React from 'react';

// After (only import what's used):
import { useState, useEffect } from 'react';
// or remove entirely if React 19+ JSX transform handles it
```

### C7 Fix — Replace arbitrary values with scale steps

```tsx
// Before:
<p className="text-[14px] leading-[22px] text-sub-dark" />
<div className="sm:py-[82px] size-[54px] rounded-[16px] max-w-[585px] w-[80%]" />

// After:
<p className="text-paragraph-sm leading-relaxed text-sub-dark" />
<div className="sm:py-20 size-14 rounded-16 max-w-xl w-4/5" />
```

Convert the whole class cluster, not just the bracket: `text-[14px] font-medium`
becomes `text-label-sm` (the step already carries weight 500). Full ramps,
rounding rules and the `text-title-*` leading trap:
`.claude/skills/refactor-layout-sizing/SKILL.md` — run
`/refactor-layout-sizing` when a file has more than a couple of these.

### D1–D4 Fix — Swap physical utilities for logical ones

A pure find/replace within `className` strings. Safe to auto-apply: in LTR the
logical utility compiles to the identical rule.

| Replace                     | With                        |
| --------------------------- | --------------------------- |
| `ml-*` → `ms-*`             | `mr-*` → `me-*`             |
| `pl-*` → `ps-*`             | `pr-*` → `pe-*`             |
| `left-*` → `start-*`        | `right-*` → `end-*`         |
| `text-left` → `text-start`  | `text-right` → `text-end`   |
| `border-l*` → `border-s*`   | `border-r*` → `border-e*`   |
| `rounded-l*` → `rounded-s*` | `rounded-r*` → `rounded-e*` |

Do **not** rewrite these when they appear inside a `ltr:` or `rtl:` variant that
is deliberately targeting one direction, or in a transform/animation keyframe
(`slide-in-from-right`), where the axis is physical by definition.

### D5 Fix — Mirror directional icons

```tsx
// Before:
<ChevronRight size={16} />

// After:
<ChevronRight size={16} className="rtl:-scale-x-100" />
```

Only for icons that point along the reading direction. Leave `X`, `Check`,
`Search`, `Plus`, `Trash2`, and status icons untouched.

### D6 Fix — Delete the reversal

`rtl:flex-row-reverse` double-mirrors an already-mirroring flex row. Remove the
variant; confirm the row still reads correctly in both directions.

### D7 Fix — Isolate technical strings

Needs judgement, so report it rather than auto-applying. Inline for a value in a
text flow, block for code:

```tsx
// value in a text flow — keeps RTL alignment, fixes character order
<span dir="ltr" className="inline-block">{phone}</span>

// code block — left-aligned in every locale
<pre dir="ltr">{JSON.stringify(payload, null, 2)}</pre>
```

### L1 / L2 Fix — Route localized reads through `getLocalizedText`

```tsx
// Before:
{
  rowData.category_name[i18n.language] ?? '-';
}
{
  store.name?.[i18n.language] ?? store.name?.en ?? '';
}

// After:
{
  getLocalizedText(rowData.category_name, { language: i18n.language });
}
{
  getLocalizedText(store.name, { language: i18n.language, fallback: '' });
}
```

Keep the original fallback's intent: `?? '-'` or no tail → omit `fallback`; `?? ''`
→ `fallback: ''`; `?? t('x')` or `?? row.id` → pass it as `fallback`. Add
`getLocalizedText` to the existing `@cms/ui` import.

### L4 Fix — Type the field `LocalizedText`

```ts
import { HTTPResponseType, type LocalizedText } from '@cms/ui';

- category_name: Record<string, string>;
+ category_name: LocalizedText;
```

### L5 Fix — Add `i18n.language` to the deps

```tsx
- }, [t, navigate]);
+ }, [t, i18n.language, navigate]);
```

### L7 Fix — Restore the full object on the write path

```tsx
-form.reset({ name: getLocalizedText(data.name, { language: i18n.language }) });
+form.reset({ name: { en: data.name?.en ?? '', ar: data.name?.ar ?? '' } });
```

More than a couple of L hits in one module? Run `/refactor-localized-text <module>` instead.

### U1 Fix — Replace state-sync useEffect with inline derivation

```tsx
// Before:
const [formattedDate, setFormattedDate] = useState('');
useEffect(() => {
  setFormattedDate(format(date, 'dd/MM/yyyy'));
}, [date]);

// After:
const formattedDate = format(date, 'dd/MM/yyyy');
```

### U3 Fix — Add cleanup function

```tsx
// Before:
useEffect(() => {
  const timer = setInterval(fn, 1000);
}, []);

// After:
useEffect(() => {
  const timer = setInterval(fn, 1000);
  return () => clearInterval(timer);
}, []);
```

---

## Step 5: Report Summary

```
## Refactor Complete — {ComponentName}.tsx

✅ Fixed:
- C1: Converted to named export function
- C3: Extracted 2 inline handlers → handleDeleteClick, handleSearchChange
- C5: Moved OrderCardProps to OrderCard.types.ts

⚠️  Flagged with TODO (requires your attention):
- C4: Inline style on line 23 — Tailwind equivalent unclear (left with TODO comment)
- U1: useEffect syncing state on line 47 — add TODO comment explaining the design decision needed

Files modified:
- {path}/OrderCard.tsx
- {path}/OrderCard.types.ts (created)
- {path}/index.ts (updated export)
```

---

## Rules

- Never remove or rename props — only fix structural violations.
- Never change component logic — only fix how it's declared and structured.
- Preserve all comments in the original file.
- For C3 (inline arrow handlers): if the inline arrow is trivially simple (e.g. `onClick={() => setOpen(false)}`), it's acceptable to keep — use judgment. Only extract if the handler has meaningful logic.
- Always confirm with the user before moving types to a separate file, as it changes the import structure.
