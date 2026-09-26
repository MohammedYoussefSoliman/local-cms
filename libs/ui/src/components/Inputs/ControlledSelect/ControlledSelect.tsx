import { Controller, type FieldValues } from 'react-hook-form';

import { Select } from '../Select';

import type { ControlledSelectProps } from './ControlledSelect.types';

export function ControlledSelect<TValues extends FieldValues>({
  name,
  control,
  ...props
}: ControlledSelectProps<TValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Select
          {...props}
          id={props.id ?? name}
          name={field.name}
          value={field.value ?? ''}
          onValueChange={field.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
