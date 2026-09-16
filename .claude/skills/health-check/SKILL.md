---
name: health-check
description: Runs all relevant audit checks on a module or app and produces a single health dashboard. Never fixes anything — use it to decide which refactor command to run next. Usage: /health-check admins [app]
---

# Health Check

One command that gives you the full health picture of a module or app. Runs structure, hook, locale, and test-coverage checks in a single pass and produces a scored dashboard. Never modifies files — use the output to decide which refactor commands to run.

---

## Arguments

- **First argument** — module name OR full app path (required). Examples: `admins`, `configuration`, `apps/dashboard`
- **Second argument** — app name (optional, defaults to `dashboard`). Only needed if first argument is a module name.

**Targeting:**

- Module: `/health-check admins` → checks `apps/dashboard/src/modules/admins/`
- App: `/health-check apps/dashboard` → checks all modules in that app

---

## Step 1: Determine Scope

If the target is a module name:

- Path: `apps/{app}/src/modules/{module}/`
- Run all 4 checks on that one module

If the target is an app path (starts with `apps/`):

- Glob all module directories under `{app}/src/modules/`
- Run all 4 checks across every module
- Produce per-module rows + an app-wide summary

---

## Step 2: Run the 4 Checks

Run all checks by reading the relevant files. Do NOT modify anything.

### Check A — Module Structure (from audit-module logic)

For each module, verify:

- `routes.tsx` exists
- `{Module}.types.ts` exists
- `services/` directory exists
- `locales/en.ts` exists
- `locales/ar.ts` exists
- `locales/index.ts` imports both files
- Routes have `layout` property

Score: (checks passed) / (total checks).

### Check B — Service Hook Violations (from audit-hooks logic)

For each `use*.ts` in `services/` — and in `hooks/`, which is where older modules keep their service hooks:

- V1: direct `import axios from 'axios'`
- V2: raw query key string
- V3: mutation missing error useEffect
- V4: mutation `onSuccess` missing `invalidateQueries`
- V5: mutation `onSuccess` missing `showToast`
- V6: `any` payload type
- V7: custom response wrapper instead of `HTTPResponseType<T>`
- V8: **invalidation key matches no live query key** (see below)
- V9: invalidation key carries filters/pagination instead of the key root alone
- V10: a query key root the write affects is never invalidated
- V11: a component in the module invalidates after `await mutateAsync(...)` instead of the hook doing it

- V15: references the removed `useGetActiveStore`

Score: (clean hooks) / (total hooks).

**V8 requires cross-referencing.** First build the module's query-key map:

```bash
grep -rn "queryKey:" apps/{app}/src/modules/{module}/
```

Resolve each `*_QUERY_KEYS.*` reference to its **string value** in `queryKeys.ts`, then check that every `invalidateQueries` key root appears in that map. `invalidateQueries` fails silently, so a mismatch produces no error — just a table that never refreshes after the user saves the form. Report V8 as **critical**: it is a user-visible bug, not a style issue.

### Check C — Locale Sync (from audit-i18n logic)

Read `locales/en.ts` and `locales/ar.ts` for each module (if they exist):

- Extract all keys from each file
- Find keys in one but not the other

Score: 1.0 if keys fully match, 0 if either file is missing, partial if some keys differ.

### Check D — Test Coverage (from test-gaps logic)

Glob all `.tsx` and non-service `use*.ts` files in the module. For each, check if a `.test.tsx`/`.test.ts` sibling exists.

Score: (tested files) / (total testable files).

### Check F — Skeleton Loading (from skeleton-loading audit logic)

For each page and component in the module that fetches data (calls a `useGet*` / `useQuery` hook, or accepts an `isLoading` prop):

- `MISSING` — component fetches data but has no `isLoading` branch with skeleton
- `GENERIC` — skeleton is a single block (`<Skeleton className="h-80 w-full" />`) instead of mirroring the real layout
- `STALE` — skeleton element count or structure doesn't match current real content
- `RTL` — skeleton uses physical-direction utilities (`ml-`, `mr-`, `left-`, `right-`)

Score: (components with accurate skeletons) / (total data-fetching components). Components that don't fetch data are excluded.

### Check G — Localized Data Reads

Grep the module for raw reads of `{ en, ar }` API fields:

```bash
grep -rnE "\[i18n\.language\]|\?\?\s*\w+(\?)?\.(en|ar)\b" apps/{app}/src/modules/{module}/
grep -rnE "(name|title|reason|_locales|translations)\s*:\s*Record<string, ?string>" apps/{app}/src/modules/{module}/types/
```

- `RAW` — unguarded `x.field[i18n.language]` → **Critical**. Throws on a `null` field and blanks the route via the error boundary.
- `GUARDED` — `?.[i18n.language] ?? x.en` → Warning. No `ar-SA`, empty-string or third-locale handling.
- `TYPE` — a localized field typed `Record<string, string>` → Warning.
- `DEPS` — a `useMemo` over localized data missing `i18n.language` → Warning.

Exclude write-path `.en`/`.ar` reads (form defaults, payloads), locale bundles, and `i18n.language` passed to formatters or headers.

Score: (localized reads using `getLocalizedText`) / (total localized reads). A module with none scores 1.0.

---

## Step 3: Produce the Dashboard

### Single-Module Output

```
## Health Check — {module} ({app})

| Category | Status | Score | Top Issue |
|----------|--------|-------|-----------|
| Module Structure | ✅ / ⚠️  / ❌ | N/N checks | {worst issue or "—"} |
| Service Hooks | ✅ / ⚠️  / ❌ | N/N hooks | {worst violation or "—"} |
| Locale Sync | ✅ / ⚠️  / ❌ | N keys | {missing keys or "—"} |
| Test Coverage | ✅ / ⚠️  / ❌ | N/N files | {largest untested file} |
| Permission Gating | ✅ / ⚠️  / ❌ | N/N pages | {worst issue, or "ungated" / "—"} |  ← dashboard only; omit the row for other apps
| Skeleton Loading | ✅ / ⚠️  / ❌ | N/N components | {worst issue: MISSING/GENERIC/STALE or "—"} |
| Localized Data | ✅ / ⚠️  / ❌ | N/N reads | {worst issue: RAW/GUARDED/TYPE or "—"} |

### Overall: ✅ Healthy / ⚠️  Needs Attention / ❌ Critical Issues

### Critical Issues (fix before next deploy)
{list any missing locale files}

### Next Actions (priority order)
1. {highest impact action with exact command}
2. {second action}
3. {third action}
```

**Status thresholds:**

- ✅ Healthy: score ≥ 90%
- ⚠️ Needs Attention: score 60–89%
- ❌ Critical Issues: score < 60% OR any Critical issue found

### App-Wide Output

```
## Health Check — {app} ({N} modules)

| Module | Structure | Hooks | Locales | Tests | Skeletons | Localized | Overall |
|--------|-----------|-------|---------|-------|-----------|-----------|---------|
| admins | ✅ 5/5 | ⚠️  27/29 | ✅ | ❌ 0% | ✅ 3/3 | ✅ 4/4 | ⚠️  |
| configuration | ❌ 3/5 | ✅ 4/4 | ❌ 1 key | ❌ 0% | ⚠️  1/2 | ❌ 0/6 | ❌ |
| rolesAndPermissions | ✅ 5/5 | ✅ 8/8 | ✅ | ⚠️  40% | ❌ 0/4 | ✅ 2/2 | ⚠️  |
...

### App Summary
- Fully healthy modules: N/N
- Modules with critical issues: N (list)
- Total hook violations: N
- Total locale sync gaps: N missing keys
- Overall test coverage: N%
- Skeleton coverage: N/N data-fetching components have accurate skeletons
- Localized reads on `getLocalizedText`: N/N (M route-crashing raw reads)

### Top 3 Priorities Across App
1. {module}: {critical issue + fix command}
2. {module}: {issue + fix command}
3. {module}: {issue + fix command}
```

---

## Rules

- Never modify any file — this command is read-only.
- Always show the exact command to fix each issue (e.g. `/refactor-hook useCreateAdmin admins`, `/refactor-module configuration`, `/refactor-localized-text configuration`, `/new-test AdminsList ...`).
- For test coverage, only count `.tsx` components and non-service `use*.ts` hooks.
- Check E runs for `dashboard` only. For any other app, drop the row entirely rather than showing it as N/A.
- "Ungated" is a status, not a failure. Never recommend adding a permission guard with a guessed key — a wrong key hides the page and its nav entry with no error message.
- If a module has no `services/` directory at all, skip Check B for that module and note it.
- Keep the "Next Actions" list to 3–5 items max — ordered by impact, not alphabetically.
