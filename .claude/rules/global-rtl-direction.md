# Direction (LTR / RTL)

Every app here ships Arabic. `dir` is set on `<html>` (see `AppEffects.tsx` / `useLocale.tsx`), so **every component renders in both directions** — including portaled overlays, which inherit from `<html>` rather than from the page tree.

**Figma designs are authored LTR.** A design is a description of the _reading-order_ layout, not of physical left and right. Implement it so it mirrors; never transcribe `left`/`right` from a design frame.

---

## Rule 1 — Logical utilities only

Physical-direction utilities do not mirror. Use the logical equivalent everywhere.

| Never                           | Always                         |
| ------------------------------- | ------------------------------ |
| `ml-*` / `mr-*`                 | `ms-*` / `me-*`                |
| `pl-*` / `pr-*`                 | `ps-*` / `pe-*`                |
| `left-*` / `right-*`            | `start-*` / `end-*`            |
| `text-left` / `text-right`      | `text-start` / `text-end`      |
| `border-l-*` / `border-r-*`     | `border-s-*` / `border-e-*`    |
| `rounded-l-*` / `rounded-r-*`   | `rounded-s-*` / `rounded-e-*`  |
| `inset-l/r`, `float-left/right` | `inset-s/e`, `float-start/end` |

```tsx
// ❌ — the close control lands on top of the header content in Arabic
<button className="absolute top-4 right-4" />

// ✅ — follows the reading direction
<button className="absolute top-4 end-4" />
```

This is not hypothetical: `@cms/ui`'s `Drawer` pinned its close button to `right-4`, which sat on top of every RTL drawer's title. Absolutely-positioned affordances are the most common place this bug hides, because flex layouts mirror on their own and mask the habit.

---

## Rule 2 — Do not "fix" RTL with `flex-row-reverse`

Flex and grid already mirror: `flex-row` lays out start-to-end, and `gap`, `justify-start`, and source order all follow `dir`. Reversing the row double-mirrors it and breaks LTR.

```tsx
// ❌ — now wrong in one of the two directions, always
<div className="flex rtl:flex-row-reverse">

// ✅ — mirrors on its own
<div className="flex">
```

Reach for `flex-row-reverse` only when the design genuinely reverses the order _within the same direction_.

---

## Rule 3 — Mirror directional icons, never symmetric ones

Chevrons, arrows, "back", next/previous, indent, and reply icons point along the reading direction and must flip. Close, check, search, plus, trash, and status icons must not.

```tsx
// ✅ — a collapsed disclosure chevron
<ChevronRight size={16} className="rtl:-scale-x-100" />

// ✅ — nothing to mirror
<X size={20} />
```

`rtl:-scale-x-100` is preferred over swapping the component: it is one class, it needs no `i18n.dir()` read, and it cannot fall out of sync with the runtime language.

---

## Rule 4 — Technical strings stay LTR

Phone numbers, emails, URLs, IDs, JSON, code, file paths, version numbers, and Latin-formatted timestamps read left-to-right in every locale. Dropped into an RTL paragraph they are re-ordered: `+966533447788` renders as `966533447788+`.

Two different fixes, and the distinction matters:

```tsx
// ✅ — a value inside a text flow: isolate INLINE so the RTL parent still
//      places it at the reading start (the right edge, in Arabic)
<p className="text-paragraph-sm text-strong">
  <span dir="ltr" className="inline-block">{log.recipient}</span>
</p>

// ✅ — a code block: dir on the BLOCK, because code is left-aligned in every
//      locale and its indentation must not mirror
<pre dir="ltr" className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>

// ❌ — dir="ltr" on a full-width block of prose: the text also jumps to the
//      left edge of an otherwise right-aligned panel
<p dir="ltr" className="w-full">{log.recipient}</p>
```

Rule of thumb: **inline `dir` isolates characters, block `dir` also moves alignment.** Pick the one whose alignment you actually want.

---

## Rule 5 — Portaled overlays need explicit checking

Radix `Dialog`, `Popover`, `Drawer`, `Tooltip`, and `Select` render into `document.body`, outside the page tree. They inherit `dir` from `<html>`, so `rtl:` variants work — but any `dir` you set on a page wrapper does **not** reach them, and their internal absolute positioning is a frequent source of physical-direction leftovers. Open every overlay in Arabic before calling it done.

---

## Rule 6 — Verify both directions

A change is not finished until it has been seen in both. Switch the locale in the app and confirm:

- No element overlaps another that did not overlap in LTR
- Icons that indicate direction point the right way
- Phone numbers, IDs, dates, and code read correctly
- Nothing is aligned to the wrong edge of its container
- Scroll and focus order still follow reading order

---

## Checklist When Implementing a Figma Design

1. Read every `left`/`right` in the design as `start`/`end`.
2. Write logical utilities from the start — retrofitting these is much more expensive than getting them right.
3. Isolate each technical string as you add it (Rule 4), not afterwards.
4. Flip directional icons (Rule 3).
5. Open the screen in Arabic, then in English, and compare against the design frame mirrored.
