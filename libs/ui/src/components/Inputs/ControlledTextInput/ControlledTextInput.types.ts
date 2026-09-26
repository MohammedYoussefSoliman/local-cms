import type { TextInputProps } from '../TextInput';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';


export type ControlledTextInputProps<TValues extends FieldValues> = Omit<
  TextInputProps,
  'name' | 'error' | 'value' | 'onChange' | 'defaultValue'
> & {
  name: FieldPath<TValues>;
  /** Optional: omitted, the field reads the form from context. */
  control?: Control<TValues>;
};
