---
name: create-pr
description: Creates a GitHub PR from the current branch with a generated title, structured body, and inline pre-flight audit results. Blocks on critical issues. Usage: /create-pr ["optional title hint"]
---

# Create Pull Request

Creates a well-structured GitHub PR from the current branch. Generates the title and body from the actual diff and commit history — not a generic template. Runs a pre-flight audit before opening and surfaces any critical issues to fix first.

---

## Arguments

- **First argument** — title hint (optional). A word or phrase to steer the title (e.g. `"feat: admins module"`). If omitted, the title is fully inferred from commits + changed files.

---

## Step 1: Read Branch State

Run these commands to understand what the PR contains:

```bash
git branch --show-current
git log main...HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD --name-only
```

If there are no commits ahead of main, stop: "Nothing to push — branch is up to date with main."

---

## Step 2: Run Pre-Flight Audit (Scoped to Changed Files)

Read each changed file in these categories and check for critical-only violations:

**Changed service hooks (`services/use*.ts` or `hooks/use*.ts`):**

- V1: direct `import axios from 'axios'`
- V3: mutation missing error useEffect
- V7: custom response wrapper instead of `HTTPResponseType<T>`
- V8: invalidation key root matches no live query key in the module

For V8, grep the module for `queryKey:` and resolve `*_QUERY_KEYS.*` to string values in `queryKeys.ts`, then confirm each `invalidateQueries` key root appears there. `invalidateQueries` fails silently, so a mismatch ships as a table that never refreshes after a save — it belongs in the blocking set.

**Changed `routes.tsx`:**

- Missing `layout` property on any route

**Changed `locales/en.ts` or `locales/ar.ts`:**

- Read both locale files; report any keys in one but missing from the other

**Changed `libs/ui/` files:**

- Read `libs/ui/src/components/index.ts` — check any new component directory is exported

Collect all critical issues found. Non-critical violations are not pre-flight blockers.

---

## Step 3: Handle Critical Issues

If critical issues were found, present them clearly:

```
⚠️  Pre-flight found N critical issue(s):

1. src/modules/configuration/services/useGetFaqs.ts — direct axios import
2. src/modules/configuration/locales/en.ts — 2 keys missing in ar.ts

Fix these before creating the PR? Options:
  A) Fix now (I'll apply the fixes, then create the PR)
  B) Create the PR anyway with issues noted in the body
  C) Cancel
```

Wait for the user's choice before proceeding.

---

## Step 4: Generate PR Title

Infer a conventional-commit title:

1. Look at all commit messages from `git log main...HEAD --oneline`
2. Look at the changed module/directory names
3. If the user provided a title hint, use it as the base

**Title format:** `{type}: {short description}` (max 70 chars)

Type inference:

- All new files in `modules/` → `feat:`
- Mostly edits to existing files → `fix:` or `refactor:`
- Only `locales/` changes → `chore:`
- `libs/ui/` changes → `feat:` or `refactor:`
- Mixed → use the dominant change type

**Examples:**

- `feat: add configuration module with FAQ management`
- `fix: sync ar locale keys in admins module`
- `refactor: migrate service hooks to axiosInstance pattern`

---

## Step 5: Generate PR Body

Build the body from the diff analysis:

```markdown
## Summary

{3-5 bullet points describing what changed at a high level}

- Added `configuration` module with FAQ list and FAQ form
- Added `useGetFaqs`, `useCreateFaq` service hooks
- Added EN/AR locale keys for configuration module

## Changed Modules / Files

{list the significant directories/files changed}

- `apps/dashboard/src/modules/configuration/` — new module (N files)
- `apps/dashboard/src/helpers/queryKeys.ts` — N new keys added
- `libs/ui/src/components/RichText/` — new component (if applicable)

## Test Plan

- [ ] {one test item per changed page or significant component}
- [ ] Verify Arabic locale renders correctly for all new keys
- [ ] Verify route navigation works with the new layout type
- [ ] {any breaking change verification steps}

{ONLY include if libs/ui was changed:}

## Breaking Changes

- Modified: `{ComponentName}` — {what changed}
- Consumers affected: {list apps that import it}

## Audit

| Check           | Result                                            |
| --------------- | ------------------------------------------------- |
| Service hooks   | {✅ N clean / ❌ N violation(s): list them}       |
| Locale sync     | {✅ Keys synced / ❌ Missing: list keys}          |
| Route structure | {✅ All have layout / ⚠️ N missing layout field}  |
| Core exports    | {✅ Intact / ❌ Missing exports: list them / N/A} |

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
```

---

## Step 6: Create the PR

Run:

```bash
gh pr create \
  --title "{generated title}" \
  --body "{generated body}" \
  --base main
```

Use `--base main` by default. Only use a different base branch if the user explicitly requests it.

If the branch hasn't been pushed yet, push it first:

```bash
git push -u origin {branch-name}
```

---

## Step 7: Return the PR URL

After creation, print the PR URL so the user can navigate to it directly.

---

## Rules

- Never skip the pre-flight — even if the user provides a title hint.
- If the branch name follows a pattern like `feat/dashboard/add-faq` or `fix/admins-locale`, use it as a strong signal for the title type.
- The Test Plan checklist should be specific to the actual changed files — never generic boilerplate like "Test the app works."
- If `gh` is not authenticated or not installed, tell the user and provide the equivalent `gh pr create` command they can run manually.
