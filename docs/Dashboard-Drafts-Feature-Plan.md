# Dashboard Drafts Feature Plan

The "المسودات" queue: every saved-but-unpublished value in the selected app, on
one screen, publishable one row at a time or in bulk.

`docs/Localization-CMS-Initial-Architecture.md` remains the source of truth for
the schema. `docs/Backend-Delivery-Plan.md` records the backend decisions this
plan is built on — particularly "One consequence of the schema, stated up
front" (lines 60–78), which is what makes "save as draft" a conditional
affordance rather than a button.

**Scope:** `apps/dashboard/src/modules/drafts/`, plus three changes outside it —
one `@cms/ui` helper, one `queryKeys` group, one backend ticket (B14).

---

## Decisions

| Question | Decision | Why |
|---|---|---|
| How does the dashboard list drafts across an app? | **New backend endpoint, `GET /apps/:appId/drafts`** (ticket B14) | Composing it client-side is not merely expensive, it is *impossible*: `TranslationRow` (`libs/contracts/src/translation.contracts.ts:93-110`) carries no author and no timestamp, and the design's "by + when" column needs both |
| Sidebar badge count | **`meta.total` from the same endpoint at `limit=1`**, same query-key root as the table | One WHERE clause, one root to invalidate, and the badge can never disagree with the list it links to |
| Which statuses are in the queue | **`draft` and `in_review`** | Nothing in the dashboard creates `in_review`, but the API and importer can, and a value that is neither live nor visible anywhere is exactly the leak this screen exists to close |
| Global-module drafts | **Excluded.** `module.app_id = :appId` only | Publishing a global value makes it live in *every* app. Putting it behind one app's "نشر الكل" is a silent cross-tenant publish |
| Is `POST /translations/:id/submit-review` surfaced? | **No.** The endpoint stays; the dashboard never calls it | Nothing blocks on it (Backend-Delivery-Plan line 50), there is no reviewer role, no inbox and no notification. A status with no consumer is a promise the product does not keep |
| "حفظ كمسودة" on a published value | **Not rendered.** The button label is derived from what the `PUT` will actually do | `translations.service.ts:131-144` leaves the status untouched on edit; a button labelled "draft" that publishes to production is the worst kind of lie |
| Warning that an edit goes live | **Persistent inline banner + explicit button label + distinct toast. No confirm modal** | A modal on every save of published copy gets click-through-blinded within a week, which is strictly worse than no modal. The banner is present *before* the first keystroke |
| Batch publish transactionality | **Not all-or-nothing.** Per-row independent; successes stay published | There is no transaction spanning N HTTP calls. Compensating with `archive` would move `published_at` and write junk history rows (invariant Rule 6) |
| Batch concurrency | **4 in flight**, fixed | Each publish is a transaction holding `SELECT … FOR UPDATE`. 4 keeps a 60-row "publish all" at ~15 waves, far under the global 120/min throttle that B10 already warns about (Backend-Delivery-Plan lines 764-769) |
| Does publish carry `expectedVersion`? | **It must — add it (B14).** Optional on the DTO, always sent by the dashboard | Without it the batch path publishes text the user never saw, and question 4's conflict UX has nothing to hang on. Optional keeps the importer and the existing e2e suite green |
| Selection state | **`useState<Set<string>>` in `DraftsPage`**, no Zustand store | A store outliving the page carries stale ids across an app switch; `key={appId}` resets the tree instead (useEffect Rule 2) |
| Conflict UX shape | **In-place panel in the editor; inline collapsed disclosure in the batch table** | Invariant Rule 7 requires showing *what landed*. N modals for N conflicts is unusable, so the batch case renders the landed value inline instead |

Still open, and worth asking rather than assuming: whether the app-detail screen
shows a draft count (if it does, `APPS_QUERY_KEYS.getAppById` joins the
invalidation set — see §7), and whether global modules eventually get their own
queue.

---

## 0. Prerequisites

### D0 — `@cms/ui` gaps that block this screen

`libs/ui/src/index.ts` exports exactly `Skeleton`, `cn`, `handleHttpError`,
`showToast`, `Toaster`. This screen additionally needs `Button`, `Checkbox`,
`Badge`, `Dialog`, `Tooltip` and a `Table` shell. All six have an obvious
second consumer (the translation editor, the apps list, the users table), so
per `global-react-components.md` they belong in `@cms/ui` from the start, not
in `modules/drafts/components/`.

**`handleHttpError` must return `details`.** It currently drops it
(`libs/ui/src/functions/handleHttpError.ts:23-26`), which makes
`TranslationConflictData` unreachable and invariant Rule 7 unimplementable:

```ts
// libs/ui/src/functions/handleHttpError.ts — additive, no call site breaks
export type HandledHttpError = {
  message: string;
  fieldErrors: Record<string, string[]>;
  /** Machine-readable context; typed per case in @cms/contracts. */
  details?: Record<string, unknown>;
};
```

`status: 'warning'` is already supported by `showToast`
(`libs/ui/src/functions/showToast.ts:4`), and `--color-warning-*` carries a
dark-theme variant, so the partial-failure toast and the live-edit banner need
no new tokens.

### D0.1 — `URLS`

```ts
// apps/dashboard/src/helpers/urls.ts
drafts: '/apps/:appId/drafts',
```

Navigation interpolates with `generatePath(URLS.drafts, { appId })` from
`react-router-dom` — no new helper, and `URLS` stays the only place a route
shape is written down (`dashboard-module-structure.md`).

---

## 1. B14 — `GET /apps/:appId/drafts`, and `expectedVersion` on the transitions

*After B6. The first ticket the dashboard plan drives; append it to
`docs/Backend-Delivery-Plan.md` after B13.*

**Goal:** the drafts queue is one query, and publishing is as safe against a
concurrent edit as saving already is.

### Why not compose it client-side

The existing surface is `GET /modules/:moduleId/entries`
(`apps/backend/src/modules/entries/module-entries.controller.ts:30-36`),
returning `TranslationRow[]` with `?search=` and `?missingLocale=` only. To
build the queue from it the dashboard would:

1. `GET /apps/:appId/modules` — paginated, so 1–N requests;
2. for each module, page through **every entry**, because there is no status
   filter — a 10-module app with 500 keys each is 50+ requests and the app's
   entire content in browser memory, to surface a handful of rows;
3. …and then still fail, because `TranslationRow.values` is
   `{ value, status, version } | null`
   (`libs/contracts/src/translation.contracts.ts:106-109`) — **no `updatedBy`,
   no `updatedAt`**. The design's "by + when" column cannot be rendered at all.

Point 3 is what settles it. Points 1–2 also mean the sidebar badge costs that
same fan-out on every page load, on every screen.

### Route table

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/apps/:appId/drafts` | *no-role: deliberate* | Paginated. Same reasoning as `GET /modules/:moduleId/entries` — an editor who cannot read the queue cannot do the job the role exists for |

`ParseUUIDPipe` on `:appId`. `AppsService.findEntityOrFail(appId)` first, so an
unknown app is 404 and not an empty list.

### Files

```
apps/backend/src/modules/translations/
  drafts.service.ts          ← new
  drafts.service.spec.ts     ← new, same commit
  app-drafts.controller.ts   ← new
  dto/list-drafts.query.dto.ts  ← extends PaginationQueryDto, adds nothing
```

Registered in the **existing** `TranslationsModule` — it already has
`TypeOrmModule.forFeature([TranslationValue, …])` and imports `AppsModule`
(`translations.module.ts:24-30`). A separate service rather than a method on
`TranslationsService` for the reason that module's own doc comment already
gives about B8 (`translations.module.ts:21-22`): a narrow read model does not
reach through the write path to get its data.

`ListDraftsQueryDto extends PaginationQueryDto` and adds no field. `search` is
inherited and **is** wired (matching `entry.key ILIKE`), so it is not the
accepted-but-ignored param B6 refused for the history endpoint
(Backend-Delivery-Plan lines 421-424).

### Contract — `libs/contracts/src/translation.contracts.ts`

```ts
/**
 * One row of the drafts queue. `id` is the `translation_values` id, which is
 * what `POST /translations/:id/publish` takes — the queue is a list of publish
 * targets, so it is addressed the way publishing addresses them.
 */
export type DraftValueRow = {
  id: string;
  entryId: string;
  key: string;
  contentType: ContentType;
  moduleId: string;
  moduleName: string;
  moduleSlug: string;
  localeCode: string;
  /**
   * The locale's OWN reading direction. Denormalized here because the value
   * cell renders in it — never in the UI language's direction, and never in a
   * direction inferred from a hard-coded `ar|he|fa` list, which is invariant
   * Rule 1's language union wearing a different hat.
   */
  localeDirection: TextDirection;
  value: string;
  /** `draft` or `in_review`. Carried so the rare in_review row can be labelled. */
  status: TranslationStatus;
  /** Send back as `expectedVersion` when publishing. */
  version: number;
  updatedAt: string;
  /** `null` when the author's account was deleted, or for importer writes. */
  updatedByName: string | null;
};
```

`TextDirection` is already imported into this file's neighbourhood via
`@cms/domain` (`libs/domain/src/locale.types.ts:6`).

### The query — one query, not N+1

```ts
private buildDraftsQuery(appId: string) {
  return this.values
    .createQueryBuilder('value')
    .innerJoin('value.entry', 'entry')
    .innerJoin('entry.module', 'module')
    .innerJoin('value.locale', 'locale')
    .leftJoin('value.updatedByUser', 'author')
    .where('value.status IN (:...statuses)', { statuses: ['draft', 'in_review'] })
    .andWhere('module.appId = :appId', { appId });
}
```

Then a narrow `select`/`addSelect` of exactly the eleven columns
`DraftValueRow` needs (typeorm Rule 7), `.orderBy('value.updatedAt', 'DESC')`,
and `.limit()/.offset()` — **not `.take()/.skip()`**, which make TypeORM emit a
distinct-id subquery that does not apply to a raw select. Count comes from
`.getCount()` on the same builder before the limit is applied; rows from
`.getRawMany()`. Two queries total, constant in the number of rows.

Both callers — the list and the count — go through `buildDraftsQuery`, which is
the reason this ticket adds no `/drafts/count` route: one WHERE clause cannot
drift from itself.

Three details worth stating because each has a wrong-looking-right alternative:

- `module.appId = :appId` excludes global modules. A global draft belongs to no
  single app, and publishing it from one app's queue would make it live in every
  other app at once.
- `status` is filtered in the **WHERE clause** and never post-filtered. It is
  the same discipline invariant Rule 4 demands of the runtime read, arriving
  from the opposite direction: here the leak would be a *published* value
  appearing in a queue that says nothing is live yet.
- The join to `users` is a `leftJoin`. `translation_values.updated_by` is
  `ON DELETE SET NULL` (`libs/database/src/entities/translation-value.entity.ts:57-62`)
  and the importer writes `null` deliberately (Backend-Delivery-Plan line 842),
  so an inner join would silently hide every imported draft.

### `expectedVersion` on the transitions

```ts
// dto/change-note.dto.ts
@IsOptional() @Type(() => Number) @IsInt() @Min(1)
expectedVersion?: number;
```

…and correspondingly on `TranslationNotePayload` in
`libs/contracts/src/translation.contracts.ts:51-53`.

In `TranslationsService.transition` (`translations.service.ts:282-319`), after
`lockValueOrFail` and **before** the `allowedFrom` check:

```ts
if (dto.expectedVersion !== undefined && dto.expectedVersion !== value.version) {
  throw staleVersion(value);   // the existing helper at :486
}
```

Version check first, `allowedFrom` second, deliberately. If a colleague already
published the row, both checks would fire; the 409 carries
`currentStatus: 'published'` in `details`, which lets the dashboard say "someone
already published this" and quietly drop the row. The 422 alternative says only
"cannot go from published to published", which sends the editor looking for a
bug.

Optional, not required: the importer, the smoke script and B10's
`translations.e2e-spec.ts` all publish without one, and last-write-wins stays
the documented behaviour of omitting it (`upsert-translation.dto.ts:17-20`).
The dashboard always sends it.

### Done when

- [ ] `GET /apps/:appId/drafts` returns every `draft` and `in_review` value in
      the app's own modules, with module name, locale code, locale direction,
      author name and timestamp, in **one** query plus its count
- [ ] A `published` value never appears, and neither does an `archived` one
- [ ] A draft in a **global** module is absent from every app's queue
- [ ] An app with 40 modules × 500 entries produces the same query count as one
      with 1 module — the N+1 box, mirroring B5's
- [ ] An unknown `:appId` → 404; a malformed one → 400 from `ParseUUIDPipe`
- [ ] `POST /translations/:id/publish` with a stale `expectedVersion` → 409
      carrying `TranslationConflictData` in `details`
- [ ] The same call with **no** `expectedVersion` still succeeds — the
      importer's and B10's existing behaviour is unchanged
- [ ] B10's automatic 401 sweep picks the new route up with nothing added by
      hand (it reads Nest's decorator metadata — Backend-Delivery-Plan lines
      733-738)
- [ ] `audit-api-auth` reports zero findings

---

## 2. File tree

Per `dashboard-module-structure.md`:

```
apps/dashboard/src/modules/drafts/
  routes.tsx
  Drafts.types.ts
  pages/
    DraftsPage.tsx
    DraftsPageSkeleton.tsx
    index.ts
  services/
    useGetAppDrafts.ts
    useGetAppDraftsCount.ts
    usePublishDraft.ts
    usePublishDrafts.ts
    index.ts
  components/
    DraftsHeader/            DraftsHeader.tsx .types.ts index.ts
    DraftsTable/             DraftsTable.tsx .types.ts DraftsTableSkeleton.tsx index.ts
    DraftRow/                DraftRow.tsx .types.ts index.ts
    DraftValueCell/          DraftValueCell.tsx .types.ts index.ts
    DraftAuthorCell/         DraftAuthorCell.tsx .types.ts index.ts
    DraftsEmptyState/        DraftsEmptyState.tsx index.ts
    PublishConfirmDialog/    PublishConfirmDialog.tsx .types.ts index.ts
    BatchResultSummary/      BatchResultSummary.tsx .types.ts index.ts
    DraftConflictDisclosure/ DraftConflictDisclosure.tsx .types.ts index.ts
    DraftsNavBadge/          DraftsNavBadge.tsx index.ts
    index.ts
  functions/
    publishInBatches.ts
    readTranslationConflict.ts
    splitPlaceholders.ts
    index.ts
  locales/
    en.ts
    ar.ts
    index.ts
```

No `stores/` — see the Decisions table. No `validations/` — this module has no
form; the editor's form lives in the translations module.

`routes.tsx`:

```tsx
import { URLS } from '@/helpers';
import { DraftsPage } from './pages';

export const draftsRoutes: RouteObject[] = [
  { path: URLS.drafts, element: <DraftsPage /> },
];
```

Registered in `apps/dashboard/src/App.tsx:9-14`, which today holds a single
placeholder route.

**`DraftsNavBadge` is the module's only export to app chrome.** The sidebar
imports the component, not the hook — one dependency instead of three (hook +
query key + count shape), and the badge's "render nothing at zero, render
nothing while loading" rule stays inside the module that owns it.

---

## 3. Types — `Drafts.types.ts`

Every type for this module, none scattered into component files.

```ts
import type { DraftValueRow, PaginationParams, TranslationConflictData } from '@cms/contracts';

export type DraftsParams = PaginationParams & { appId: string };

/** Why one row of a batch failed, in the terms the table renders. */
export type DraftPublishFailureKind =
  | 'conflict'    // 409 — it moved while the queue was on screen
  | 'forbidden'   // 403
  | 'transition'  // 422 — the status moved out from under the publish
  | 'missing'     // 404 — deleted; drop it on refetch
  | 'unknown';

export type DraftPublishFailure = {
  id: string;
  kind: DraftPublishFailureKind;
  message: string;
  /** Present only when `kind === 'conflict'`. */
  conflict: TranslationConflictData | null;
};

/** A batch result. `usePublishDrafts` resolves with this; it never rejects. */
export type DraftsPublishResult = {
  succeeded: string[];
  failed: DraftPublishFailure[];
};

export type PublishDraftPayload = {
  id: string;
  expectedVersion: number;
};

export type DraftsPublishPayload = {
  rows: PublishDraftPayload[];
};

/** One segment of a value split for placeholder highlighting. */
export type ValueSegment =
  | { kind: 'text'; text: string }
  | { kind: 'placeholder'; text: string };
```

`DraftValueRow` itself is **not** redeclared here — it crosses the wire, so it
lives in `@cms/contracts` (`dashboard-module-structure.md`, Types).

---

## 4. Service hooks

One hook per file, `global-api-service.md` throughout.

### `useGetAppDrafts(params: DraftsParams)`

| | |
|---|---|
| HTTP | `GET /apps/${appId}/drafts` with `{ page, limit, search }` |
| Query key | `[DRAFTS_QUERY_KEYS.getAppDrafts, params]` |
| Response | `HTTPResponseType<PaginatedList<DraftValueRow>>`; `queryFn` returns `res.data` (the axios interceptor already unwrapped the envelope — `config/axios.ts:74-77`) |
| Options | `placeholderData: (previous) => previous`, `throwOnError: false`, `enabled: Boolean(appId)` |
| Invalidates | nothing — it is a query |
| Errors | `useEffect` on `error` → `handleHttpError(error, t('someThingWentWrong'))` → `showToast`. Never `onError` |

### `useGetAppDraftsCount(appId: string)`

| | |
|---|---|
| HTTP | the **same** route, `{ page: 1, limit: 1 }` |
| Query key | `[DRAFTS_QUERY_KEYS.getAppDrafts, { appId, page: 1, limit: 1 }]` — same root, different params |
| Returns | `{ count: data?.meta.total ?? 0, isLoading }` |
| Errors | **Silent.** No toast. A failed badge fetch must not put an error toast on every screen in the product; the drafts page itself reports the failure when the user goes there |

The shared root is the point: §7's invalidations refresh the table and the badge
in one call, and the two can never disagree about how many drafts exist.

### `usePublishDraft()`

| | |
|---|---|
| HTTP | `POST /translations/${id}/publish` with `{ expectedVersion }` |
| Payload | `PublishDraftPayload` |
| Invalidation | the full set in §7, in one `Promise.all` in `onSuccess` |
| Toast | `showToast({ status: 'success', variant: 'filled', title: res?.message \|\| t('draftPublished') })` |
| Errors | `useEffect` on `mutation.error`. A 409 additionally feeds `readTranslationConflict` so `DraftRow` can render the disclosure — the toast alone would be the "you lost" invariant Rule 7 forbids |

### `usePublishDrafts()`

The batch hook. `mutationFn` takes `DraftsPublishPayload` and **resolves with
`DraftsPublishResult` in every case, including total failure** — a rejected
mutation would put the partial successes somewhere the UI cannot reach them.

```
mutationFn:
  publishInBatches(rows, 4, (row) =>
    axiosInstance.post(`/translations/${row.id}/publish`,
                       { expectedVersion: row.expectedVersion }))
  → classify each rejection by status into DraftPublishFailure
  → return { succeeded, failed }

onSuccess(result):
  invalidate the §7 set ONCE, in one Promise.all, after everything settled
  result.failed.length === 0 → toast success, "نُشرت {n} قيمة"
  result.succeeded.length === 0 → toast error,   "تعذّر نشر {n} قيمة"
  otherwise                    → toast warning,  "نُشرت {ok} من {total}. فشل {bad}."
```

Errors: `mutation.error` is only ever a programming fault here (the mutationFn
catches transport failures per row), so the `useEffect` stays — it is the rule's
shape and a thrown bug should still surface — but the per-row reporting is the
`result`, not the error.

**No invalidation per item.** N invalidations mean N refetches of a table the
user is staring at, each one re-rendering and re-numbering a live selection.
One, at the end.

---

## 5. Components

Every one of these gets its own folder with `.tsx` / `.types.ts` / `index.ts`,
named function declarations, named exports, `cn` for class merging, no inline
JSX arrow handlers, no arbitrary Tailwind values.

### `DraftsPage`

Owns: `appId` from `useParams`, page state, selection state, the confirm
dialog's open state, the last `DraftsPublishResult`.

- Selection is `useState<Set<string>>`. **Never mirrored from the data in an
  effect.** The ids that are actually actionable are derived during render:
  `const selectedRows = rows.filter((row) => selected.has(row.id))` — so a row
  that vanished on a refetch stops counting with no effect and no stale id
  (useEffect Rules 1 and 2).
- The table subtree carries `key={appId}` so switching apps resets selection
  structurally rather than through an effect (useEffect Rule 2).
- `isLoading` → `DraftsPageSkeleton`. `!isLoading && rows.length === 0` →
  `DraftsEmptyState`.

### `DraftsHeader`

Breadcrumb (app name → المسودات), title, the body copy, and the two batch
buttons.

- "نشر المحدد · {n}" — `disabled={selectedRows.length === 0 || isPublishing}`.
  While a batch runs the label becomes `نشر المحدد · {done}/{total}`, derived
  from mutation state.
- "نشر الكل" — `disabled={meta.total === 0 || isPublishing}`.
- Body copy renders as a `text-paragraph-sm` block, not a tooltip: "قيم محفوظة
  ولم تُنشر بعد. لا توجد خطوة مراجعة: النشر يجعلها مباشرة في التطبيقات فوراً."
  It is the one sentence that explains why this screen has no "approve" button,
  so it is always visible.
- **"نشر الكل" publishes the whole queue, not the visible page.** It enumerates
  every id first by paging `GET /apps/:appId/drafts` at `limit=100` until
  exhausted, *before* issuing a single publish. Enumerate-then-publish, not
  interleaved: publishing shifts the result set under a paging cursor and rows
  would be skipped.

Skeleton: breadcrumb `h-3 w-32 rounded-4`, title `h-5 w-24 rounded-4`, two
buttons `h-9 w-32 rounded-8` and `h-9 w-24 rounded-8`, copy `h-3.5 w-96` +
`h-3.5 w-64`.

### `DraftsTable` / `DraftsTableSkeleton`

Columns, in reading order: checkbox | key + module name | locale code | value |
by + when | نشر.

- Header checkbox is tri-state over the **current page** only, and its label
  says so ("تحديد الصفحة"). A "select all 412" that silently means "the 20 you
  can see" is the bug this naming prevents.
- `DraftsTableSkeleton` is **Rule 7 priority 1** in `global-skeleton-loading.md`
  and is the first thing built. Same card wrapper as the real table
  (`rounded-12 border border-soft-light`), a header row, then **8 rows** — the
  fold, not the page size; a 20-row skeleton scrolls past the viewport and
  animates content nobody is waiting for. Per row: `size-4 rounded-4`,
  `h-3.5 w-40` + `h-3 w-24`, `h-5 w-10 rounded-full`, `h-3.5 w-full`,
  `h-3 w-28`, `h-8 w-16 rounded-8`.

### `DraftRow`

A row, its checkbox, its per-row "نشر" button, and — when this row is in the
last batch's `failed` list — an inline error chip and, for `kind: 'conflict'`,
the `DraftConflictDisclosure` beneath it.

Per-row publish sends `expectedVersion: row.version` and does **not** confirm.
One row, fully visible, and reversible through archive or rollback.

Skeleton: none of its own — the table's covers it (Rule 4: the page skeleton is
the composition of its children's).

### `DraftValueCell`

The RTL-critical component.

```tsx
<div dir={row.localeDirection} className="text-paragraph-sm text-strong">
  {splitPlaceholders(row.value).map((segment, index) =>
    segment.kind === 'placeholder' ? (
      <span key={index} dir="ltr"
        className="inline-block rounded-full bg-soft-light px-1.5 font-mono text-label-xs">
        {segment.text}
      </span>
    ) : (
      segment.text
    ),
  )}
</div>
```

`dir` comes from `row.localeDirection` — the locale row's own direction — and
**never** from `i18n.dir()` or `useLocale()`. An Arabic UI listing a French
draft must render that draft LTR. It is on the block rather than inline because
the value is a paragraph in its own language and its *alignment* follows that
language (`global-rtl-direction.md` Rule 4: block `dir` also moves alignment).

Truncate to two lines with `line-clamp-2` and a `title` attribute; the full
value belongs in the editor, not in a queue row.

### `DraftAuthorCell`

`updatedByName ?? t('importedOrDeletedAuthor')` plus a relative timestamp from
`Intl.RelativeTimeFormat(i18n.language)`, with the absolute
`Intl.DateTimeFormat(i18n.language)` value in `title`. A Latin-numeral
timestamp rendered into an Arabic UI is isolated inline
(`<span dir="ltr" className="inline-block">`); an Arabic-formatted one is not,
because isolating it would fight its own direction.

### `DraftsEmptyState`

Check-circle icon (symmetric — **not** mirrored, `global-rtl-direction.md`
Rule 3) over "لا توجد مسودات. كل شيء منشور." No skeleton: it only renders after
loading resolved.

### `PublishConfirmDialog`

Opens for **both** batch actions, never for a per-row publish. Carries the exact
count, the app name, and one line of consequence: "سيتم نشر {n} قيمة في «{app}»
مباشرة. يتم نشر كل قيمة على حدة، وما ينجح يبقى منشوراً."

That last clause is the not-all-or-nothing contract, stated before the click
rather than discovered after a partial failure.

Portaled → open it in Arabic before calling it done (`global-rtl-direction.md`
Rule 5). Close affordance is `end-4`, never `right-4` — the exact bug that rule
records against `@cms/ui`'s `Drawer`.

### `BatchResultSummary`

A dismissible banner above the table after a partial batch: "نُشرت 4 من 7." plus
a "تحديد الفاشلة فقط" action that reduces the selection to `result.failed`, so
a retry re-attempts exactly the failures.

### `DraftConflictDisclosure`

The batch-path half of invariant Rule 7. Collapsed: one line, "تغيّرت هذه القيمة
منذ فتح الصفحة", plus a chevron carrying `rtl:-scale-x-100` (Rule 3). Expanded:
two read-only blocks — "ما كان معروضاً" (the row's `value`) and "ما هو محفوظ
الآن" (`conflict.currentValue`) — each in the row's `localeDirection`, plus
`currentVersion` and a `currentStatus` chip. Two actions: "نشر ما هو محفوظ
الآن" (re-publish with `expectedVersion: conflict.currentVersion`) and "فتح في
المحرر".

**Never auto-retries with the new version.** An automatic retry after a 409 is
silent publication of text the user has not read, which is the one outcome
Rule 7 names as unacceptable.

### `DraftsNavBadge`

`count === 0` → renders `null`. `isLoading` → also renders `null`, **not** a
skeleton. This is a deliberate exception to `global-skeleton-loading.md` Rule 1,
and the reason is that the badge is absent at zero anyway: a pulsing pill that
resolves to nothing is a flash of phantom work on every navigation.

---

## 6. "حفظ كمسودة" — when it exists, and what to say when it does not

This table is the product rule. The **translation editor** (a different module)
implements it; it is recorded here because the drafts queue is what gives
`draft` its meaning, and because modules never import from each other — if the
warning banner ever needs a second consumer it goes to `@cms/ui`, not across a
module boundary.

The backend fact it all follows from:
`TranslationsService.upsert` leaves `status` untouched on an existing row
(`translations.service.ts:131-144`), so a `PUT` publishes a published value and
does nothing to the status of any other.

| Current value state | "حفظ كمسودة" | Primary action | What the editor sees |
|---|---|---|---|
| **missing** — `values[code] === null`. There is no `TranslationStatus` for this; it is the absence of a row (`translation.contracts.ts:106-109`) | **Shown, enabled, and it is the primary action** | "حفظ كمسودة" — a plain `PUT`, which creates the row as `draft` | Nothing special. This is the ordinary case the queue exists for |
| **draft** | **Shown, enabled** | "حفظ كمسودة" | A "مسودة" chip. Secondary: "نشر الآن" = `PUT` then `POST publish` |
| **in_review** | **Hidden.** Replaced by "حفظ" | "حفظ" — the `PUT` keeps `in_review`, so a button saying "draft" would be wrong | A "قيد المراجعة" chip. The value is not live either way, so the plain label is honest. Nothing in the dashboard can *produce* this state (see below) |
| **published** | **Not rendered at all** | **"حفظ ونشر مباشرة"** | See the three-part warning below |
| **archived** | **Hidden.** Replaced by "حفظ" | "حفظ" — the `PUT` keeps `archived`; still not live | A "مؤرشفة" chip, plus a secondary "إعادة النشر" — `publish` allows `archived` in its `allowedFrom` set (`translations.service.ts:161-173`), deliberately, so archiving is not a one-way trap |

**The rule underneath the table:** the button's label is derived from what the
`PUT` will actually do to the status. There is never a button labelled "draft"
that publishes, and never one labelled "save" that goes live.

### Telling the editor that an edit goes live — three parts, none of them a footnote

1. **A persistent inline banner**, `bg-warning-lighter` / `border-warning-light`,
   rendered *above* the textarea in the card and panel layouts and directly under
   the locale header in the focus layout. Present before the first keystroke, not
   after: "هذه القيمة منشورة. الحفظ ينشر التعديل مباشرة في التطبيقات."
2. **The button carries it too** — "حفظ ونشر مباشرة", not a neutral "حفظ". The
   banner can be scrolled past; the button cannot be clicked without being read.
3. **A distinct success toast** — "نُشر التعديل مباشرة"
   (`status: 'success'`), different wording from the draft save's
   "حُفظت كمسودة", so the two are told apart at a glance in a fast editing
   session.

**No confirm modal**, and that is a decision rather than an omission. A modal on
every save of published copy is the most common interaction in a mature CMS;
within a week it is dismissed without reading, at which point it is strictly
worse than the banner because it has trained the muscle memory the banner was
relying on. The confirm is reserved for the batch actions, where the count is
large and the action is one click.

### `submit-review` is not surfaced in this MVP

`POST /translations/:id/submit-review` stays on the API and the dashboard never
calls it. Three reasons, in order of weight:

1. **Nothing blocks on it.** The decision table in
   `docs/Backend-Delivery-Plan.md:50` records direct publish: `in_review` is
   settable and advisory. An editor who submits for review gains nothing they
   did not already have and loses a click.
2. **There is no reviewer.** No reviewer role, no review inbox, no notification.
   A status that no screen lists and no person is told about is a promise the
   product does not keep.
3. **It would move work out of the one screen that lists it.** The queue is
   keyed on unpublished status, and a "submit" button that appears to make your
   work vanish is a support ticket per use.

Mitigation for values that reach `in_review` through the API or the importer:
the queue's WHERE clause covers `draft` **and** `in_review` (§1), and
`DraftValueRow.status` is carried so the row can be labelled. When
review-before-publish becomes a real gate, this button is surfaced in the same
change that adds the reviewer role and the inbox — not before.

---

## 7. Cache invalidation

New group in `apps/dashboard/src/helpers/queryKeys.ts`, added in the same commit
as the first hook:

```ts
export const DRAFTS_QUERY_KEYS = {
  getAppDrafts: 'getAppDrafts',
} as const;
```

**One root, deliberately.** No `getDraftsCount`: the badge hangs off
`getAppDrafts` with different params, so one root invalidation refreshes the
table *and* the badge, and the two cannot drift.

Every drafts mutation — `usePublishDraft` and `usePublishDrafts` — invalidates
all of these, root only, no `exact: true`, in one `Promise.all` inside the
hook's `onSuccess` (never at the call site — Rule 4):

| Key root | Why it changes |
|---|---|
| `DRAFTS_QUERY_KEYS.getAppDrafts` | The row leaves the queue. Same root drives the sidebar badge |
| `TRANSLATIONS_QUERY_KEYS.getEntries` | The entry's cell in the translation table flips `draft` → `published` (`TranslationRow.values[code].status`) |
| `TRANSLATIONS_QUERY_KEYS.getValueHistory` | Every publish writes a `translation_value_versions` row (invariant Rule 6, `translations.service.ts:326-340`) |
| `MODULES_QUERY_KEYS.getModuleById` | The module's unpublished/missing counts. Named explicitly in `global-api-service.md` Rule 3's own example |

**Not invalidated, and why** — recording the negatives is what keeps the
enumeration meaningful rather than a reflex to invalidate everything:

- `TRANSLATIONS_QUERY_KEYS.getEntryById` — publishing changes no field of
  `EntryResponseData` (key, description, contentType, timestamps).
- `APPS_QUERY_KEYS.getAppById` — nothing in `AppResponseData`
  (`libs/contracts/src/app.contracts.ts:31-41`) is derived from value status.
  **If** the app-detail screen grows a draft count, this joins the set; it is on
  the open-questions list above for that reason.
- `LOCALES_QUERY_KEYS.*` — untouched by a publish.

### The cross-module one that will be forgotten

`useUpsertTranslation` **in the translations module** must invalidate
`DRAFTS_QUERY_KEYS.getAppDrafts` too. Saving the first-ever value for a locale
creates a `draft` row: a new line in this queue and a bumped sidebar badge,
from a mutation that lives in a different module and has no other reason to
think about drafts.

This is legal and is not a module-to-module import: `queryKeys.ts` is
`@/helpers`, shared app infrastructure. Its full set is
`TRANSLATIONS_QUERY_KEYS.getEntries`, `.getValueHistory`,
`MODULES_QUERY_KEYS.getModuleById`, `DRAFTS_QUERY_KEYS.getAppDrafts`.

Verification step before the PR, per the rule's own instruction:

```bash
grep -rn "queryKey:" apps/dashboard/src/modules/drafts/ apps/dashboard/src/modules/translations/
```

Every `useQuery` root in that output that a publish or an upsert can affect must
appear in an `invalidateQueries` call inside those mutation hooks.

---

## 8. `functions/`

Named exports, lowercase names, JSDoc on each — `global-react-components.md`.

### `publishInBatches`

```ts
/**
 * Runs `task` over `items` with at most `limit` in flight, preserving input
 * order in the result and never rejecting: each item settles into
 * `{ ok: true, value } | { ok: false, error }`.
 *
 * Bounded because every publish is a transaction holding a row lock, and
 * because the API throttles at 120/min per IP — an unbounded Promise.all over
 * a 400-row queue would 429 halfway through and report it as a content error.
 */
```

Pure, dependency-free, and the easiest thing in the module to test.

### `readTranslationConflict`

```ts
/**
 * Narrows a 409's `details` to `TranslationConflictData`, or null.
 *
 * `handleHttpError` returns `details` as `Record<string, unknown>` because the
 * envelope is shared by every error; this is the one typed reader, so the
 * three-field shape is asserted in exactly one place.
 */
export function readTranslationConflict(error: unknown): TranslationConflictData | null;
```

Checks the status is 409 **and** that `currentValue` / `currentVersion` /
`currentStatus` are present and of the right primitive types. A 409 from a
unique-constraint violation elsewhere in the API carries no `details`
(`http-exception.filter.ts:94-100`) and must return `null`, not a half-built
object.

### `splitPlaceholders`

```ts
/**
 * Splits a value into text and `{placeholder}` segments for chip rendering.
 * Matches `{identifier}` only — a bare `{` or a nested ICU plural arm is left
 * as text, because half-highlighting an ICU message reads as corruption.
 */
export function splitPlaceholders(value: string): ValueSegment[];
```

Regex `/\{[A-Za-z_][A-Za-z0-9_]*\}/g`. ICU `{count, plural, ...}` deliberately
does **not** match: its first token looks like a placeholder but the rest is
syntax, and chipping only the head is worse than chipping none of it. The
editor is where ICU gets a real renderer.

---

## 9. RTL

`<html dir>` is set by `useLocale` from `i18n.language`
(`apps/dashboard/src/hooks/useLocale.ts:16-19`) and describes the **UI**
language. Content on this screen does not inherit from it.

| Element | Direction source | Mechanism |
|---|---|---|
| Value cell | `row.localeDirection` | `dir` on the **block** — alignment follows the value's language |
| Placeholder chips | always `ltr` | `dir="ltr"` + `inline-block` — isolate characters without moving the surrounding line |
| Locale code (`ar`, `pt-BR`) | always `ltr` | `dir="ltr"` + `inline-block` — a technical string (Rule 4) |
| Entry key (`checkout.add_to_cart`) | always `ltr` | same |
| Module name | UI language | localized chrome, inherits |
| Timestamp | `i18n.language` via `Intl` | isolate inline only when the formatted output is Latin-numeral inside an Arabic UI |
| Layout spacing | logical only | `ms/me`, `ps/pe`, `start/end`, `text-start/end` — never `ml/mr`, `left/right`, `text-left/right` |

Further, and each of these is a specific trap:

- **`localeDirection` is in the contract for a reason.** Inferring direction
  from the code with `['ar','he','fa','ur'].includes(code)` is invariant Rule 1's
  compile-time language union in a different costume — adding Divehi would be a
  code change. It comes from `locales.direction`, which is a column
  (`libs/domain/src/locale.types.ts:16`).
- **No `flex-row-reverse` anywhere.** The checkbox is first in source order and
  mirrors on its own (Rule 2). Reversing it breaks LTR.
- **Only the disclosure chevron mirrors** (`rtl:-scale-x-100`). The empty
  state's check-circle, the per-row publish icon and the close control do not
  (Rule 3).
- **The confirm dialog is portaled** — it inherits `dir` from `<html>`, not from
  the page tree, and any absolute positioning inside it uses `start-`/`end-`
  (Rule 5). Open it in Arabic before calling the feature done.
- **Arabic UI, LTR value, RTL value, all on one screen** is the normal case for
  this table, not an edge case. Rule 6's both-directions check here means
  checking both *content* directions inside each UI direction — four
  combinations.

---

## 10. Test plan

### Vitest — `apps/dashboard`, `.test.tsx` alongside the source (matching `src/config/axios.test.ts`)

| Test | Asserts |
|---|---|
| `DraftValueCell.test.tsx` | **The direction invariant.** UI language `en`, row `localeDirection: 'rtl'` → the value block carries `dir="rtl"`. Then UI language `ar`, row `'ltr'` → `dir="ltr"`. This is the test that fails the day someone reaches for `i18n.dir()` |
| `DraftValueCell.test.tsx` | `"مرحباً {name}"` renders one `dir="ltr"` chip containing `{name}`; `"{count, plural, one{#} other{#}}"` renders **no** chip |
| `DraftsPage.test.tsx` | Empty response → empty state, both batch buttons disabled. Non-empty → "نشر الكل" enabled, "نشر المحدد" disabled until a checkbox is ticked, then labelled with the exact count |
| `DraftsPage.test.tsx` | Selection survives a refetch that keeps the row, and silently drops a row the refetch removed — with no `useEffect` in the component (assert by behaviour: no extra render pass sets state) |
| `DraftsTableSkeleton.test.tsx` | Renders while `isLoading`, the real table is absent, the skeleton row count is 8 |
| `publishInBatches.test.ts` | Concurrency never exceeds 4 (instrument the task with an in-flight counter); result order matches input order; never rejects even when every task rejects |
| `usePublishDrafts.test.ts` | 7 ids, 3 rejecting (`vi.spyOn(axiosInstance, 'post')`) → resolves `{ succeeded: 4, failed: 3 }` and **does not throw**; `invalidateQueries` is called **once per key root, after all seven settled** (spy on the `QueryClient`) — the per-item-invalidation regression |
| `usePublishDrafts.test.ts` | Each rejection maps to the right `DraftPublishFailureKind`: 409 → `conflict` with a populated `conflict`, 403 → `forbidden`, 422 → `transition`, 404 → `missing` |
| `usePublishDraft.test.ts` | Invalidates exactly the four roots in §7; sends `expectedVersion` from the row |
| `readTranslationConflict.test.ts` | Extracts `details` from an `AxiosError` shaped like `HTTPErrorResponse`; returns `null` for a 409 **without** `details` (the unique-violation 409) and for a 422 |

No MSW — it is not a dependency. `vi.spyOn(axiosInstance, ...)` is enough, and
`renderWithProviders` (`apps/dashboard/src/test/renderWithProviders.tsx`)
already supplies a fresh `QueryClient` per test.

### Jest — `apps/backend`, for B14

`drafts.service.spec.ts`, testing the **domain invariants this read owns**, not
that a repository method was called:

- A `published` value is absent from the result; so is an `archived` one.
- A `draft` in a **global** module is absent from an app's queue — the
  cross-tenant publish this WHERE clause prevents.
- An `in_review` value **is** present, carrying `status: 'in_review'`.
- A draft whose author was deleted (`updated_by IS NULL`) is present with
  `updatedByName: null` — the `leftJoin`, which an `innerJoin` would silently
  hide along with every imported draft.
- Query count is constant in the number of rows returned: the B5 N+1 box.

`translations.service.spec.ts`, additions:

- Publish with a stale `expectedVersion` → 409 whose `details` is
  `TranslationConflictData`.
- Publish with **no** `expectedVersion` still succeeds — the importer's and
  B10's behaviour, guarded.
- The version check fires **before** `allowedFrom`: a row already published by
  someone else answers 409 with `currentStatus: 'published'`, not 422.

### E2E — `apps/backend/test/drafts.e2e-spec.ts`

- A value written by `PUT /entries/:id/translations/:code` appears in
  `GET /apps/:appId/drafts`, and disappears after
  `POST /translations/:id/publish`.
- An editor's token gets 200 (the route is deliberately role-free); B10's
  automatic sweeps pick up the 401 case with nothing hand-maintained.
- A draft in a global module is absent from the app's queue over HTTP.
- `meta.total` at `limit=1` equals the row count at `limit=100` — the badge
  contract, asserted rather than assumed.
- Stale `expectedVersion` on publish → 409 with `details.currentVersion`.

---

## 11. Sequence

```
D0  @cms/ui primitives + handleHttpError.details + URLS.drafts
 │
B14 GET /apps/:appId/drafts  +  expectedVersion on ChangeNoteDto
 │        (backend; ship the contract type first so the dashboard can compile)
 ├─ D1  queryKeys group, Drafts.types.ts, useGetAppDrafts, DraftsTableSkeleton
 ├─ D2  DraftsPage + DraftsTable + DraftRow + DraftValueCell + empty state
 ├─ D3  usePublishDraft + per-row publish + conflict disclosure
 ├─ D4  usePublishDrafts + publishInBatches + confirm dialog + BatchResultSummary
 ├─ D5  DraftsNavBadge + useGetAppDraftsCount, wired into the sidebar
 └─ D6  the editor's save-as-draft affordance table (§6) — translations module
```

D1 ships the skeleton **before** the table, which is the order
`global-skeleton-loading.md` Rule 7 asks for and the only order in which the
skeleton actually gets built.

D6 is listed last because it lives in another module, but §6 is a hard
dependency of anyone reviewing it — the drafts queue is what gives `draft` its
meaning, and the editor is where a wrong label puts unreviewed copy on a live
storefront.
