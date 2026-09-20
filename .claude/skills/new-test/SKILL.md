---
name: new-test
description: Generate a test file — Vitest + React Testing Library for the dashboard and libs/ui, or Jest + @nestjs/testing for the API. Usage: /new-test TranslationsService [file-path]
---

# New Test File Scaffold

Two runners, chosen by where the file lives. Do not mix them.

| Location                          | Runner              | Command             |
| --------------------------------- | ------------------- | ------------------- |
| `apps/backend/**`                     | Jest + `@nestjs/testing` | `pnpm test:backend` |
| `apps/dashboard/**`, `libs/ui/**` | Vitest + RTL        | `pnpm --filter=@cms/dashboard test` |

---

## Arguments

- `$1` — component, hook, or service name (required)
- `$2` — path to the source file (optional; ask if the name is ambiguous)

---

## Step 1: Read the source file first

Never generate tests from a name. Read the file and identify:

- **Services** — which branches throw, which invariant the method protects,
  which repository calls need mocking
- **Components** — props, conditional branches (loading / empty / error),
  user interactions, hooks that need mocking
- **Hooks** — inputs, the query key, what the error path does

---

## Step 2: Test the rule, not the plumbing

The single most common wasted test asserts that a mock was called. Write the
test that fails if someone deletes a line of real logic.

```ts
// ❌ — passes whatever the business rule is
expect(repo.save).toHaveBeenCalled();

// ✅ — fails if the published-only filter is removed
const bundle = await service.getBundle('storefront', 'ar');
expect(bundle).not.toHaveProperty('products.unreleased_key');
```

`.claude/rules/cms-domain-invariants.md` is the backlog: each rule there is a
test worth having.

---

## Step 3a: API service test (Jest)

```ts
import { {Entity} } from '@cms/database';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { {Feature}Service } from './{feature}.service';

describe('{Feature}Service', () => {
  let service: {Feature}Service;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(async (row: unknown) => row),
      create: jest.fn((row: unknown) => row),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        {Feature}Service,
        { provide: getRepositoryToken({Entity}), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get({Feature}Service);
  });

  it('throws when the record does not exist', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });
});
```

Style reference: `apps/backend/src/modules/auth/auth.service.spec.ts`.

A service test never touches a real database. If the behaviour under test is a
database constraint, it belongs in an E2E spec — see
`.claude/rules/nestjs-testing.md`.

---

## Step 3b: Dashboard component test (Vitest + RTL)

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';

import { {Component} } from './{Component}';

describe('{Component}', () => {
  it('renders the records it is given', () => {
    renderWithProviders(<{Component} records={[{ id: '1', name: 'Storefront' }]} />);
    expect(screen.getByText('Storefront')).toBeInTheDocument();
  });

  it('calls onSelect when a row is clicked', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<{Component} records={[…]} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /storefront/i }));

    expect(onSelect).toHaveBeenCalledWith('1');
  });
});
```

Always use `renderWithProviders` from `@/test/renderWithProviders` — it
supplies a **fresh** QueryClient and a router per test. A shared QueryClient
leaks cached data between tests and produces failures that reproduce only in
suite order.

### Query by role, not by test id

```tsx
// ✅ — also asserts the element is reachable by assistive tech
screen.getByRole('button', { name: /publish/i });

// ❌
screen.getByTestId('publish-button');
```

### Arabic / RTL

The dashboard ships Arabic. For any component with directional layout, add a
test that renders it with `dir="rtl"` and asserts nothing physical leaked in —
see `.claude/rules/global-rtl-direction.md`.

---

## Step 4: Cover the branches you found in Step 1

At minimum: the happy path, the empty state, the error state, and each
conditional branch. A component with a loading branch and no loading test is
half-tested.

---

## Rules

- Test file sits next to its source: `Thing.tsx` → `Thing.test.tsx`.
- One `describe` per unit; nested `describe` per method or state.
- No snapshot tests for anything with logic — they assert nothing and get
  regenerated on failure.
- Never weaken an assertion to make a test pass. If the test is right and the
  code is wrong, say so.
