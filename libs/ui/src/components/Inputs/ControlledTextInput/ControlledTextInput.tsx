import { Controller, type FieldValues } from 'react-hook-form';

import { TextInput } from '../TextInput';

import type { ControlledTextInputProps } from './ControlledTextInput.types';

/**
 * The error prop is wired here, never at the call site: threading
 * `errors.email?.message` by hand is redundant and drifts the moment a field is
 * renamed (`.claude/rules/global-forms.md`, Error Display).
 */
export function ControlledTextInput<TValues extends FieldValues>({
  name,
  control,
  ...props
}: ControlledTextInputProps<TValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextInput
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
