---
paths:
  - '**/*.tsx'
  - '**/*.types.ts'
---

# React 19+ Component Standards

This project uses **React 19+** with **TypeScript**. Follow these rules strictly when creating or modifying components. No exceptions unless explicitly told otherwise.

---

## Component Structure

Each component lives in its own folder named after the component (PascalCase). Required files per component:

- `{ComponentName}.tsx` — main component
- `{ComponentName}.types.ts` — all types and props
- `index.ts` — re-exports everything: `export * from './ComponentName'`

Optional subfolders follow the same pattern — each has its own `index.ts` that exports everything:

```
Avatar/
  Avatar.tsx
  Avatar.types.ts
  index.ts
  functions/
    formatAvatarUrl.ts
    index.ts
  constants/
    avatarSizes.ts
    index.ts
  mocks/
    Avatar.mock.ts
    index.ts
  stories/
    Avatar.stories.tsx
    Avatar.mdx
```

---

## Component Declaration

- Use **named exports** only. No default exports for components.
- Use **normal function declarations**. No arrow function components.
- Arrow functions are allowed only when wrapping with `memo`.

```ts
// ✅ Correct
export function Avatar() {}

// ✅ Memo exception
export const Avatar = memo(function Avatar() {});

// ❌ Wrong — arrow function component
const Avatar = () => {};

// ❌ Wrong — default export
export default Avatar;
```

---

## React Imports

Always destructure from React. Never use the default `React` import.

```ts
// ✅
import { useState } from 'react';

// ❌
import React from 'react';
React.useState();
```

---

## Props & Types

- All types go in `{ComponentName}.types.ts` as named exports.
- Use `type` by default. Use `interface` only when extending another type or interface.
- For components that support refs, use `ComponentPropsWithRef` (React 19 standard).
- Keep prop names semantic and predictable.
- Avoid excessive boolean props.
- Prefer composition over configuration.
- Do not mirror props in state unless absolutely necessary.

```ts
import type { ComponentPropsWithRef } from 'react';

export interface AvatarProps extends ComponentPropsWithRef<'img'> {
  src: string;
}
```

---

## Shared vs. module components

A component used by more than one feature module belongs in `libs/ui`
(`@cms/ui`) and must be exported from `libs/ui/src/index.ts` in sorted order.
A component used by exactly one module stays in that module's `components/`
folder. Promote it to `@cms/ui` on the second consumer, not in anticipation of
one.

> Storybook is **not** set up in this workspace. The frontend monorepo requires
> a `stories/` folder per component; here that requirement is deliberately
> dropped until Storybook is added to `libs/ui`. Do not scaffold `.stories.tsx`
> files that nothing runs.

---

## Styling

- Use **Tailwind CSS only**. No inline styles, no CSS modules, no manual string concatenation.
- Use the `cn` utility for all class merging.

```ts
// ✅
className={cn('w-10 h-10 md:w-12 md:h-12', className)}

// ❌
className={`w-10 ${className}`}
```

### Direction — logical utilities only

Every app ships Arabic, and Figma designs are authored LTR. Use `ms/me`, `ps/pe`,
`start-*/end-*`, `text-start/end` — never `ml/mr`, `pl/pr`, `left/right`, or
`text-left/right`. Mirror directional icons with `rtl:-scale-x-100`, and isolate
technical strings (phone numbers, IDs, JSON) with `dir="ltr"`. Full rules:
`.claude/rules/global-rtl-direction.md`.

```tsx
// ❌ — sits on top of the header content in Arabic
<button className="absolute top-4 right-4" />

// ✅ — follows the reading direction
<button className="absolute top-4 end-4" />
```

### Relative units only — no arbitrary values

**Every class must come from the scale. `utility-[value]` is banned outright.**
The test is syntactic: if a class contains `[` … `]`, it is a violation — font
sizes, line heights, radii, spacing, widths, colors and z-index alike. Rem inside
the brackets does not make it legal: `text-[0.875rem]` still bypasses the type
ramp (so it carries no weight or leading) and `w-[36.5rem]` is still invisible to
the container scale. Never use `!` to force a size past a design-system default
either.

```tsx
// ❌ — private constants inlined into a class attribute
<div className="sm:py-[82px] size-[54px] rounded-[16px] max-w-[585px]" />
<p className="text-[14px] leading-[22px]" />
<Modal className="md:!w-[600px]" />

// ✅ — token steps, all rem/relative
<div className="sm:py-20 size-14 rounded-16 max-w-xl" />
<p className="text-paragraph-sm leading-relaxed" />
<Modal className="md:min-w-xl" />
```

Tokens live in `libs/ui/src/styles/` — type ramp in `typography.css`, radii in
`border-radius.css`, colors in `colors.css`. Spacing (`p-20` = 5rem) and the
container scale (`max-w-xl` = 36rem) are rem-based. Percentages become fractions
(`w-[80%]` → `w-4/5`), and a radius that equals half its box becomes
`rounded-full`. Full conversion recipe, including the type-step and leading
traps: `.claude/skills/refactor-layout-sizing/SKILL.md`.

The one carve-out to "no inline styles" above is a value that only exists at
runtime and no class can hold — a progress bar's
`style={{ width: progress + '%' }}`. Keep the unit relative and keep everything
static about the element in classes.

Overriding a `@cms/ui` component from the dashboard is the common trap:
`@cms/ui/styles.css` is imported before the app's own utilities in
`src/main.tsx`, so same-specificity conflicts are decided by source order
rather than by intent. Use `min-w-*` (CSS resolves min-width before width), or
add a variant to the `@cms/ui` component — not `!important`.

---

## State Management

- **Avoid `useEffect()`** for derived state, data transforms, or event logic. See `.claude/rules/global-react-useeffect.md` for detailed guidance and examples.
- Derive values during render instead of syncing them via effects.
- Fetch data with **TanStack Query** (`@tanstack/react-query`), not raw effects.
- Avoid unnecessary `useState()` — derive from props or existing state when possible.
- Localize state to the lowest component that needs it.
- Prefer controlled components.

---

## Event Handling

No inline arrow functions in JSX event handlers. Name handlers clearly: `handleClick`, `handleSubmit`, `handleChange`, `handleClose`.

```ts
// ✅
function handleClick() { ... }
<button onClick={handleClick} />

// ❌
<button onClick={() => { ... }} />
```

---

## Functions, Constants, Mocks & Other Utilities

- Place reusable logic in the `functions/` subfolder, constants in `constants/`, mocks in `mocks/`.
- Each subfolder must have its own `index.ts` that exports everything.
- All functions must have JSDoc comments.
- Function names start with a lowercase character.
- Use named exports only.

```ts
/**
 * Formats avatar URL with required size parameters.
 */
export function formatAvatarUrl(url: string): string {
  return `${url}?size=200`;
}
```

---

## Performance

- Avoid premature optimization.
- Use `useMemo()` and `useCallback()` only for **proven** performance bottlenecks.
- Keep list keys stable and meaningful.

---

## General Rules

- Write code for humans first — readable, explicit, predictable.
- Keep components small, flat, and focused on a single responsibility.
- Avoid deeply nested JSX.
- If a pattern feels complex, reconsider the component boundary.
- Components must be composable and easy to refactor.
