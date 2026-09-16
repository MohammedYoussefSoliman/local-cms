---
name: review-pr
description: Reviews a pull request by running targeted audit checks on changed files and producing a structured Critical / Warnings / Suggestions / Verdict report. Usage: /review-pr [pr-number]
---

# PR Review

Perform a thorough, context-aware review of the current branch or a specific PR number. This command reads only what changed — then runs the relevant audit checks against those files.

---

## Arguments

- **First argument** — PR number (optional). If omitted, compares current branch against `main` using `git`.

---

## Step 1: Get the Changed Files

**If a PR number was provided:**

```bash
gh pr diff {number} --name-only
gh pr view {number} --json title,body,headRefName,baseRefName
```

**If no PR number (local branch):**

```bash
git diff main...HEAD --name-only
git log main...HEAD --oneline
git branch --show-current
```

Collect the list of changed files. If no files changed vs main, report: "Nothing to review — branch is up to date with main."

---

## Step 2: Categorize Changed Files

Group the changed file list into these buckets:

| Bucket          | Pattern                                   | Checks to Run                               |
| --------------- | ----------------------------------------- | ------------------------------------------- |
| Service hooks   | `**/services/use*.ts`, `**/hooks/use*.ts` | Hook violations (V1–V11)                    |
| Locale files    | `**/locales/en.ts` or `**/locales/ar.ts`  | en/ar key parity                            |
| Route files     | `**/routes.tsx`                           | Route structure (layout field)              |
| Core library    | `libs/ui/src/**`                          | Barrel exports, breaking changes            |
| Zustand stores  | `**/store/*.ts`                           | Business logic in setters                   |
| Components      | `**/*.tsx` (not stories, not test)        | Codex violations                            |
| API controllers | `apps/api/**/*.controller.ts`             | Auth coverage (A1–A9)                       |
| API services    | `apps/api/**/*.service.ts`                | Transactions, pagination, N+1               |
| DTOs            | `apps/api/**/dto/*.ts`                    | Validator coverage, `@Type` on query params |
| Entities        | `libs/database/src/entities/*.ts`         | Domain invariants, missing migration        |
| Migrations      | `libs/database/src/migrations/*.ts`       | Reversible `down()`, constraints            |

---

## Step 3: Run Targeted Checks

For each non-empty bucket, read the changed files and run the appropriate checks:

### Service hooks — check all violations per file

Read each changed service hook file (in `services/` or `hooks/`):

- **V1**: `import axios from 'axios'` present? → Critical
- **V2**: `queryKey:` contains a string literal (not `*_QUERY_KEYS.`)? → Critical
- **V3**: File has `useMutation` but no error `useEffect` watching `mutation.error`? → Critical
- **V4**: Mutation has `onSuccess:` but no `invalidateQueries`? → Warning
- **V5**: Mutation has `onSuccess:` but no `showToast`? → Warning
- **V6**: `mutationFn: async (data: any)` or `(payload: any)`? → Warning
- **V7**: Custom response wrapper instead of `HTTPResponseType<T>` from `@cms/ui`? → Warning
- **V8**: Invalidation key root matches no live query key in the module? → **Critical**
- **V9**: Invalidation key carries filters/pagination, or passes `exact: true`? → Critical
- **V10**: A query key root this write affects is never invalidated? → Warning
- **V11**: A component invalidates after `await mutateAsync(...)` instead of the hook? → Warning

**V8–V10 need module context, not just the diff.** When a mutation hook is in the diff, read the module's query hooks too and build a key-root map:

```bash
grep -rn "queryKey:" apps/{app}/src/modules/{module}/
```

Resolve `*_QUERY_KEYS.*` references to their string values in `queryKeys.ts` before comparing — matching on the property name gives false passes. `invalidateQueries` matches by prefix and fails silently, so a mismatched key is invisible in review unless you check it explicitly; the symptom is a table that still shows stale rows after the user saves. Treat V8 as blocking.

### API controllers — auth coverage

Delegate to the `audit-api-auth` agent for the changed controllers, or apply
its checks inline. Enforce `.claude/rules/nestjs-auth.md`:

| ID  | Check                                                              |
| --- | ------------------------------------------------------------------ |
| A1  | `@Public()` outside login / refresh / health — **always critical** |
| A3  | Redundant `@UseGuards(JwtAuthGuard)` (it is already global)        |
| A4  | Mutating endpoint with no `@Roles()` and no justification comment  |
| A5  | `@Req()` used to read `.user` instead of `@CurrentUser()`          |
| A7  | Entity returned to the client without field mapping                |
| A8  | Auth endpoint with no `@Throttle()`                                |

### API services — data access

| ID  | Check                                                                |
| --- | -------------------------------------------------------------------- |
| S1  | Multi-table write not wrapped in a transaction (value + history row) |
| S2  | Unpaginated `find()` on a table that grows                           |
| S3  | Runtime read path missing `status = 'published'`                     |
| S4  | Role check inside the service instead of `@Roles()`                  |
| S5  | `version` assigned by hand instead of left to `@VersionColumn`       |
| S6  | Pre-check `SELECT` standing in for a unique constraint               |

### Entities and migrations

- An entity change with no migration in the same diff is **critical** —
  `synchronize` is off, so the schema simply will not match.
- Every migration needs a `down()` that actually reverses `up()`.
- Constraints TypeORM cannot generate (partial unique indexes, CHECKs) must be
  present in the migration, not assumed from decorators.
- A migration that already ran in a shared environment must not be edited.
- A change that adds a language-shaped column violates
  `.claude/rules/cms-domain-invariants.md` Rule 1 — flag it as critical.

### Locale files — key parity

If `en.ts` changed but `ar.ts` is NOT in the diff (or vice versa):

- Read both locale files for each affected module
- Extract keys from each `addResourceBundle` object
- Report any keys present in one but not the other → Critical

### Route files — structure check

Read each changed `routes.tsx`:

- Find every route object (has `path:` property)
- Check if `layout:` is present (should use the app's layout enum)
- Missing `layout` → Warning

### Core library — export chain

If any `libs/ui/src/` files changed:

- Read `libs/ui/src/index.ts` — verify all top-level barrels are exported
- Read `libs/ui/src/components/index.ts` — verify any newly added component directory is exported
- For each modified component: note the component name for the breaking-change summary

### Zustand stores — no business logic

Read each changed `store/*.ts` file. Look for:

- `async` keyword inside a setter function → Critical (API call in store)
- `axios` or `useQuery` imported in store file → Critical
- `useEffect` or `fetch` inside store → Critical

### Localized data — no raw `[i18n.language]` reads

For every changed `.ts`/`.tsx`, plus any `.types.ts` in the diff:

```bash
grep -nE "\[i18n\.language\]|\?\?\s*\w+(\?)?\.(en|ar)\b" {changed files}
```

- **L1**: `x.field[i18n.language]` with no `?.` → **Critical**. The first `null` from the backend throws `Cannot read properties of null` and the error boundary blanks the whole route.
- **L2/L3**: `x.field?.[i18n.language] ?? x.field?.en` → Warning. Survives null but misses `ar-SA`, empty strings, and any third locale.
- **L4**: a localized field typed `Record<string, string>` in a changed `.types.ts` → Warning. That type is what lets L1 compile.
- **L5**: a `useMemo` reading localized data whose deps omit `i18n.language` → Warning (stale label after a locale switch).
- **L7**: `getLocalizedText` inside `form.reset` / `defaultValues` / a mutation payload → **Critical**. It collapses `{ en, ar }` to one language and the save wipes the other.

Not violations: `.en`/`.ar` reads on a write path, `i18n.language` passed to a date formatter or an `Accept-Language` header, and locale bundle files.

Reference: `.claude/rules/cms-domain-invariants.md`. Fix: `/refactor-localized-text <module>`.

### Components — codex spot-check

For each changed `.tsx` file (exclude `.stories.tsx`, `.test.tsx`):

- `export default function` or `export default` → Warning (should be named export)
- `style={{` → Warning (inline styles). Exception: a value that only exists at
  runtime and no class can express, e.g. `style={{ width: progress + '%' }}`
- Tailwind arbitrary value — any class containing brackets → **Critical**
  (`grep -nE '(^|[^a-zA-Z])[a-z-]+-\[[^]]+\]'`). Covers `text-[14px]`,
  `sm:py-[82px]`, `rounded-[16px]`, `max-w-[585px]`, `bg-[#F5F5F5]`. Rem inside
  the brackets is still a violation. Ignore non-class hits (JS array literals,
  `viewBox`, generics). Fix: `/refactor-layout-sizing <file>`
- `!` on a sizing utility (`!w-`, `md:!max-w-`) → **Critical** (forcing past a
  design-system default)
- Physical-direction utility (`ml-`, `pr-`, `left-`, `text-right`, `border-l-`)
  → Warning. Fix: `/refactor-component`
- JSX prop with inline arrow: `onClick={() =>` or `onChange={(e) =>` → Suggestion

---

## Step 4: Produce the Review Report

```markdown
## PR Review — {branch} → {base}

**Commits:** {N commits}
**Files changed:** {N files}
**Reviewed:** {timestamp}

---

### Critical Issues — must fix before merge

{list each issue with file path and line context, or "None ✅"}

### Warnings — should fix

{list each issue with file, or "None ✅"}

### Suggestions — nice to have

{list each issue with file, or "None"}

---

### Checklist

| Category                         | Files Checked | Status                                    |
| -------------------------------- | ------------- | ----------------------------------------- |
| Service hooks                    | N             | ✅ Clean / ❌ N violations                |
| Locale sync                      | N pairs       | ✅ Synced / ❌ N keys missing             |
| Route structure                  | N routes      | ✅ All set / ⚠️ N missing layout          |
| Core exports                     | -             | ✅ Intact / ❌ N missing                  |
| Zustand stores                   | N             | ✅ Clean / ❌ N violations                |
| Permission gating (dashboard)    | N pages       | ✅ Clean / ⚠️ N ungated / ❌ N violations |
| Relative units (no `[…]` values) | N files       | ✅ Clean / ❌ N arbitrary values          |

---

### Verdict

❌ **Needs Changes** — {N} critical issue(s) must be resolved.
OR
⚠️ **Approved with Warnings** — No critical issues. {N} warnings to address.
OR
✅ **Approved** — All checks pass.
```

---

## Rules

- Only check files that are in the diff — do not scan the entire codebase.
- Locale check: if only `en.ts` is in the diff, still read `ar.ts` from disk to check parity.
- Critical issues block the verdict. Warnings and suggestions don't.
- If you can't get git diff (e.g., not a git repo), say so clearly.
- Do not auto-fix anything — this command is read-only. Point to the appropriate fix command: `/refactor-hook`, `/refactor-module`, `/refactor-component`, or `/refactor-localized-text`.
