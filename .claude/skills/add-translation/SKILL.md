---
name: add-translation
description: Add a translation key to both en.ts and ar.ts locale files. Usage: /add-translation "keyName" "English text" "النص العربي" [module] [app?]
---

# Add Translation Key

Add a new i18n key to both `en.ts` and `ar.ts` locale files for a module, keeping them in sync. Never add a key to only one locale file.

---

## Arguments

- **First argument** — key name in camelCase (required). Example: `adminCreatedSuccessfully`
- **Second argument** — English text (required). Example: `"Admin created successfully"`
- **Third argument** — Arabic text (required). Example: `"تم إنشاء المشرف بنجاح"`
- **Fourth argument** — module name (required). Example: `admins`, `configuration`, `rolesAndPermissions`
- **Fifth argument** — app name (optional, defaults to `dashboard`)

If any required argument is missing, ask before proceeding.

---

## Step 1: Locate the locale files

Files to edit:

- `apps/{app}/src/modules/{module}/locales/en.ts`
- `apps/{app}/src/modules/{module}/locales/ar.ts`

Read both files before making any edits to understand the existing structure.

---

## Step 2: Check for duplicates

Search both files for the key name. If the key already exists:

- Report the existing value
- Ask the user if they want to update it or use a different key name

---

## Step 3: Add the key to `en.ts`

Insert the new key at the end of the `i18n.addResourceBundle` object, before the closing `}`):

```ts
// In en.ts — add before closing }):
  {keyName}: '{English text}',
```

---

## Step 4: Add the key to `ar.ts`

Insert the same key in the same relative position:

```ts
// In ar.ts — add before closing }):
  {keyName}: '{Arabic text}',
```

---

## Step 5: Verify sync

After editing, confirm both files have the exact same set of keys. If they were previously out of sync, report the discrepancy and offer to fix it.

---

## Usage in Code

After adding, the key is used via `useTranslation`:

```tsx
const { t } = useTranslation('app');
t('{keyName}'); // → 'English text' or 'Arabic text' based on locale
```

---

## Batch Mode

If the user provides multiple keys at once (e.g. a list), process all of them in a single pass — edit both locale files once rather than one key at a time.
