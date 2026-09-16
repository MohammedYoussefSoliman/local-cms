---
name: new-component
description: Scaffold a new React component following the react-component rules. Usage: /new-component ComponentName [path/to/destination]
---

# New Component Scaffold

Scaffold a complete React component strictly following the rules defined in:

- `.claude/rules/global-react-components.md` — component structure, declaration, types, styling, events
- `.claude/rules/global-react-useeffect.md` — state management and effect rules
- `.claude/rules/cms-domain-invariants.md` — reading `{ en, ar }` API fields via `getLocalizedText`

---

## Instructions

Parse the arguments:

- **First argument** — component name in PascalCase (required)
- **Second argument** — destination path relative to the repo root (optional)

If no destination path is provided, ask the user where to place the component before creating any files.

---

## File Structure to Create

```
{ComponentName}/
  {ComponentName}.tsx
  {ComponentName}.types.ts
  index.ts
  stories/
    {ComponentName}.stories.tsx
    {ComponentName}.mdx
```

Add optional subfolders only if the component requires them:

```
  functions/        ← reusable logic extracted from the component
    index.ts
  constants/        ← component-specific constants
    index.ts
  mocks/            ← mock data for tests/stories
    index.ts
```

---

## File Templates

### `{ComponentName}.tsx`

```tsx
import { cn } from '@/functions';

import type { {ComponentName}Props } from './{ComponentName}.types';

export function {ComponentName}({ className, ...props }: {ComponentName}Props) {
  return (
    <div className={cn('', className)} {...props} />
  );
}
```

Rules applied (from `global-react-components.md`):

- Named `export function` — no default export, no arrow function (except when wrapping `memo`)
- Destructured React imports — never `import React`
- `cn()` from `@/functions` for all class merging — no inline styles
- No inline arrow functions in JSX — name event handlers `handleX`
- Derive values during render — no `useEffect` for state sync (see `global-react-useeffect.md`)

### `{ComponentName}.types.ts`

```ts
import type { ComponentPropsWithRef } from 'react';

export interface {ComponentName}Props extends ComponentPropsWithRef<'div'> {
  // component-specific props
}
```

Rules applied:

- `type` by default; `interface` only when extending
- `ComponentPropsWithRef` for ref-capable components (React 19 standard)
- All types are named exports

### `index.ts`

```ts
export * from './{ComponentName}';
export * from './{ComponentName}.types';
```

### `stories/{ComponentName}.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';

import { {ComponentName} } from '../{ComponentName}';

const meta: Meta<typeof {ComponentName}> = {
  title: 'Components/{ComponentName}',
  component: {ComponentName},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof {ComponentName}>;

export const Default: Story = {
  args: {},
};
```

### `stories/{ComponentName}.mdx`

```mdx
import { Canvas, Meta } from '@storybook/blocks';
import * as {ComponentName}Stories from './{ComponentName}.stories';

<Meta of={{ComponentName}Stories} />

# {ComponentName}

Description of the component and its purpose.

<Canvas of={{ComponentName}Stories.Default} />
```

---

## After Scaffolding

1. Check if the destination folder has a barrel `index.ts` — if so, add the new export in sorted order.
2. Remind the user to fill in component-specific props in `{ComponentName}.types.ts` and implement the component body in `{ComponentName}.tsx`.
3. **Skeleton loading** — if the component will fetch data (query hook or `isLoading` prop), generate a matching skeleton following `.claude/rules/global-skeleton-loading.md`. Run the `/skeleton-loading` skill logic inline: read the component's rendered layout and produce a skeleton that mirrors its structure, spacing, and element proportions. Do not defer this to a separate step — the skeleton ships with the component.
4. Do not add complexity beyond the minimum scaffold — let the user guide further implementation.
