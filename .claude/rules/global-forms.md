---
paths:
  - '**/*.tsx'
---

# Form Pattern

> **Status.** These conventions are inherited from the frontend monorepo and
> are the contract the dashboard's form layer is built against. The `Form`
> wrapper and the `Controled*` inputs named below do not exist in `@cms/ui`
> yet — Phase 3 creates them to this spec. Until then, build a form with bare
> `react-hook-form` + `zodResolver` following the schema, default-value, and
> submit rules here, and put the shared pieces in `@cms/ui` as they emerge.

This project uses **React Hook Form v7** + **Zod v4** for all forms. The `Form` component and controlled input components from `@cms/ui` are the standard building blocks. Follow these rules strictly when creating or modifying forms.

---

## Zod Schema

Define the schema as a **hook** inside a `validations/` folder. This gives the schema access to `useTranslation` for localized error messages. Each module should have:

```
validations/
  use{Entity}FormSchema.ts
  index.ts                    ← re-exports hook and type
```

```ts
// ✅ — validations/useAdminFormSchema.ts
import * as z from 'zod';
import { useTranslation } from 'react-i18next';

export const useAdminFormSchema = () => {
  const { t } = useTranslation('app');

  return z.object({
    firstName: z.string().min(1, { message: t('firstNameIsRequired') }),
    email: z
      .string()
      .email()
      .min(1, { message: t('emailIsRequired') }),
    roleId: z.string().min(1, { message: t('roleIsRequired') }),
    status: z.boolean(),
  });
};

export type AdminFormValues = z.infer<ReturnType<typeof useAdminFormSchema>>;
```

```ts
// ❌ — const schema outside a hook (no access to translations)
const createAdminSchema = z.object({ ... });

// ❌ — schema defined inline inside a component
function MyForm() {
  const schema = z.object({ ... });
}
```

For create vs. update variants, compose with `.extend()` inside the hook:

```ts
export const useAdminFormSchema = (mode: 'create' | 'update') => {
  const { t } = useTranslation('app');

  const base = z.object({
    firstName: z.string().min(1, { message: t('firstNameIsRequired') }),
    email: z
      .string()
      .email()
      .min(1, { message: t('emailIsRequired') }),
  });

  if (mode === 'create') {
    return base.extend({
      password: z.string().min(8, { message: t('passwordTooShort') }),
    });
  }
  return base.extend({ password: z.string().optional() });
};
```

---

## Form Component Structure — WrappingForm + FormFields

**Always** split forms into two components to leverage `useFormContext`:

1. **`WrappingForm.tsx`** — Owns schema resolution, default values, and the `Form` wrapper. Accepts `children`.
2. **`FormFields.tsx`** — Contains all fields and submit logic. Uses `useFormContext` to access form methods.

This separation keeps schema setup isolated from field logic and makes `useFormContext` available naturally in `FormFields` without prop-drilling `control`, `handleSubmit`, `reset`, etc.

### WrappingForm

```tsx
import { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@cms/ui';
import { useAdminFormSchema, type AdminFormValues } from '../validations';

const INITIALIZE_DEFAULTS: AdminFormValues = {
  firstName: '',
  email: '',
  roleId: '',
  status: true,
};

export function WrappingForm({ children }: { children: ReactNode }) {
  const schema = useAdminFormSchema();

  return (
    <Form<AdminFormValues>
      resolver={zodResolver(schema)}
      defaultValues={INITIALIZE_DEFAULTS}
      className="flex flex-col gap-4"
    >
      {children}
    </Form>
  );
}
```

### FormFields

```tsx
import { useFormContext } from 'react-hook-form';
import type { AdminFormValues } from '../validations';

export function FormFields() {
  const { control, handleSubmit, reset } = useFormContext<AdminFormValues>();

  // All form fields, submit logic, and data pre-filling go here
  return (
    <>
      <TextInput
        control={control}
        name="firstName"
        label={t('firstName')}
        required
      />
      <TextInput control={control} name="email" label={t('email')} required />
      <Button onClick={handleSubmit(onSubmit)}>{t('save')}</Button>
    </>
  );
}
```

### Composed form

Wire them together in a minimal component:

```tsx
export function AdminForm() {
  return (
    <WrappingForm>
      <FormFields />
    </WrappingForm>
  );
}
```

### When to use `useForm` directly

Only when you need **imperative access** to the form instance outside the render tree (e.g. resetting from a parent component). In this case, wrap the form JSX with `<FormProvider {...methods}>`.

---

## Always Provide `defaultValues`

**Always** pass fully typed `defaultValues`. Never rely on undefined field values — they cause uncontrolled-to-controlled warnings and type errors.

```ts
// ✅
defaultValues: { firstName: '', email: '', status: true }

// ❌ — partial or missing defaultValues
defaultValues: {}
```

---

## Controlled Input Components

**Always** use the controlled input components from `@cms/ui`. Never use raw `<input>`, `<select>`, or `<textarea>` elements inside a form.

| Input type                    | Component                       |
| ----------------------------- | ------------------------------- |
| Text, email, password, number | `TextInput`                     |
| Dropdown select               | `SelectInput`                   |
| Checkbox                      | `CheckboxInput`                 |
| Radio group                   | `RadioGroupInput`               |
| Phone number                  | `PhoneNumberInputField`         |
| OTP                           | `ControledOtpInput`             |
| Rich text                     | `RichTextInput`                 |
| URL                           | `UrlInput` (controlled variant) |
| Textarea                      | `Textarea` (controlled variant) |
| Combobox                      | `ComboBox` (controlled variant) |

All controlled inputs share this interface:

```tsx
<TextInput<CreateAdminFormValues>
  name="firstName" // Path<CreateAdminFormValues> — typed field path
  control={control} // Control<CreateAdminFormValues> from useForm or Form render function
  label={t('firstName')}
  required // adds * marker to label
/>
```

---

## Non-Standard Inputs — Use `Controller`

For any input component that doesn't have a built-in controlled variant (e.g. a toggle, switch, date picker, file uploader), wrap it with `Controller` from `react-hook-form`:

```tsx
import { Controller } from 'react-hook-form';

<Controller
  control={control}
  name="isActive"
  render={({ field }) => (
    <Switch checked={field.value} onCheckedChange={field.onChange} />
  )}
/>;
```

Never manage these with separate `useState` and then sync via `useEffect`.

---

## Submit Handler

Call `handleSubmit` in a button's `onClick` — do **not** use a `<form onSubmit={...}>` element, as layouts use flex/grid containers rather than native form elements.

```tsx
// ✅
<Button onClick={() => handleSubmit(onSubmit)()} isLoading={isSubmitting}>
  {t('save')}
</Button>

// ✅ — also valid when using the Form component (it handles submission internally)
<Button type="submit" isLoading={isSubmitting}>{t('save')}</Button>

// ❌ — avoid
<form onSubmit={handleSubmit(onSubmit)}>
```

---

## Error Display

Errors flow automatically from Zod → React Hook Form → the input component's `error` prop. You do **not** need to manually pass errors to inputs.

```tsx
// ✅ — errors handled automatically
<TextInput name="email" control={control} label={t('email')} />

// ❌ — manually threading errors is redundant
<TextInput name="email" control={control} label={t('email')} error={errors.email?.message} />
```

---

## No `useState` for Form Values

Never use `useState` to mirror or track form field values. React Hook Form owns form state.

```tsx
// ❌ — redundant state
const [email, setEmail] = useState('');
<TextInput
  name="email"
  control={control}
  onChange={(e) => setEmail(e.target.value)}
/>;

// ✅ — read values when needed with watch() or getValues()
const email = watch('email');
```

---

## Pre-filling Form Values After Async Fetch

When form values come from an API (e.g. edit mode), use `reset()` inside a `useEffect` that fires when the data arrives. This is one of the valid `useEffect` use cases — it syncs external data into the form.

```tsx
const { data: admin } = useGetAdmin(adminId);

useEffect(() => {
  if (!admin) return;
  reset({
    firstName: admin.firstName,
    email: admin.email,
    roleId: admin.roleId,
    status: admin.status,
  });
}, [admin, reset]);
```

---

## Form in a Modal

Forms are commonly placed inside a `Modal`. The submit button goes in the modal footer:

```tsx
<Form<AdminFormValues>
  defaultValues={defaults}
  resolver={zodResolver(schema)}
  onSubmit={onSubmit}
>
  {({ control, handleSubmit, formState: { isSubmitting } }) => (
    <Modal
      title={t('createAdmin')}
      footer={
        <Button
          onClick={() => handleSubmit(onSubmit)()}
          isLoading={isSubmitting}
        >
          {t('save')}
        </Button>
      }
    >
      <TextInput
        name="firstName"
        control={control}
        label={t('firstName')}
        required
      />
      <SelectInput
        name="roleId"
        control={control}
        label={t('role')}
        options={roleOptions}
        required
      />
    </Modal>
  )}
</Form>
```

---

## Create / Update Form Page

When a form serves both create and update on a dedicated page, add a page wrapper on top of the standard WrappingForm + FormFields structure. Reference: `apps/dashboard/src/modules/configuration/` (FaqForm).

### File structure

```
modules/{Module}/
  {Entity}FormPage.tsx          ← Page wrapper (breadcrumb + layout)
  components/
    {Entity}Form.tsx            ← Composes WrappingForm + FormFields
    WrappingForm.tsx            ← Schema, resolver, defaultValues (see above)
    FormFields.tsx              ← Fields, mode detection, submit logic (see above)
  validations/
    use{Entity}FormSchema.ts    ← Zod schema hook (see above)
    index.ts
```

### Page wrapper (`{Entity}FormPage.tsx`)

Handles breadcrumb and outer layout only. Renders the composed form component:

```tsx
export default function ThingFormPage() {
  const { t } = useTranslation('app');
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    setBreadcrumbItems([
      { children: <ToolIcon />, to: URLS.home },
      { children: t('things'), to: URLS.thingsList },
      {
        children: id ? t('editThing') : t('addThing'),
        className: 'font-medium',
      },
    ]);
    return () => setBreadcrumbItems([]);
  }, [id]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col p-4 gap-4 bg-white shadow-regular-xs rounded-8 overflow-hidden">
        <ThingForm />
      </div>
    </div>
  );
}
```

### FormFields — create/update specifics

Inside `FormFields.tsx`, handle dual-mode logic:

```tsx
export function FormFields() {
  const { t } = useTranslation('app');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { control, handleSubmit, reset } = useFormContext<ThingFormValues>();

  const { data } = useGetThingById(id);
  const { mutateAsync: createThing, isLoading: isCreating } = useCreateThing();
  const { mutateAsync: updateThing, isLoading: isUpdating } = useUpdateThing();
  const isSubmitting = isCreating || isUpdating;

  // Pre-fill form in edit mode
  useEffect(() => {
    if (id && data) {
      reset({ name: data.name, is_active: data.is_active });
    }
  }, [id, data]);

  // Dual-mode submit
  const onSubmit = useCallback(
    async (values: ThingFormValues) => {
      if (id) {
        await updateThing({ thingId: id, payload: values });
      } else {
        await createThing(values);
      }
      navigate(URLS.thingsList);
    },
    [id, navigate, updateThing, createThing],
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <span>{id ? t('editThing') : t('addNewThing')}</span>
        <div className="flex items-center gap-3">
          <Button
            color={id ? 'error' : 'neutral'}
            variant="lighter"
            size="2xs"
            onClick={() => navigate(URLS.thingsList)}
          >
            {id ? t('delete') : t('discard')}
          </Button>
          <Button
            color={id ? 'success' : 'primary'}
            size="2xs"
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting || undefined}
          >
            {id ? t('saveChanges') : t('addThing')}
          </Button>
        </div>
      </div>
      <TextInput control={control} name="name" label={t('name')} required />
    </>
  );
}
```

### Key rules for this pattern

- **Mode detection:** `useParams().id` — present means edit, absent means create.
- **Pre-fill with `reset()`:** Always guard with `if (id && data)` inside `useEffect`.
- **Separate mutation hooks:** One `useCreate{Entity}` and one `useUpdate{Entity}` — never a single combined hook.
- **Navigate on success:** After either create or update, navigate back to the list page.
- **Loading state:** Combine both mutation loading states: `const isSubmitting = isCreating || isUpdating`.
- **Button labels:** Change button text and color based on mode (`addThing` / `saveChanges`, `discard` / `delete`).
