import { Controller, type FieldValues } from 'react-hook-form';

import { Textarea } from '../Textarea';

import type { ControlledTextareaProps } from './ControlledTextarea.types';

export function ControlledTextarea<TValues extends FieldValues>({
  name,
  control,
  ...props
}: ControlledTextareaProps<TValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Textarea
          {...props}
          {...field}
          id={props.id ?? name}
          value={field.value ?? ''}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
