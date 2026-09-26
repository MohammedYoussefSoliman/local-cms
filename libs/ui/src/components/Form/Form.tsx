import { type FieldValues, FormProvider, useForm } from 'react-hook-form';

import { cn } from '../../functions';

import type { FormProps } from './Form.types';

/**
 * Owns the `useForm` instance and puts it on context, so fields reach it with
 * `useFormContext` instead of prop-drilling `control` through every layer.
 *
 * It renders a `<form>` element and wires `onSubmit`, so a `type="submit"`
 * button works — but callers whose layout cannot nest inside a form element
 * (a modal footer, a flex toolbar) call `handleSubmit(onSubmit)()` from the
 * button's click handler instead, via the render-function form of `children`.
 */
export function Form<TValues extends FieldValues>({
  onSubmit,
  children,
  className,
  ...formProps
}: FormProps<TValues>) {
  const methods = useForm<TValues>(formProps);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!onSubmit) return;
    void methods.handleSubmit(onSubmit)(event);
  }

  return (
    <FormProvider {...methods}>
      <form
        noValidate
        onSubmit={handleSubmit}
        className={cn('flex flex-col gap-4', className)}
      >
        {typeof children === 'function' ? children(methods) : children}
      </form>
    </FormProvider>
  );
}
