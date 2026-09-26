import type { SelectProps } from '../Select';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';


export type ControlledSelectProps<TValues extends FieldValues> = Omit<
  SelectProps,
  'name' | 'error' | 'value' | 'onValueChange'
> & {
  name: FieldPath<TValues>;
  control?: Control<TValues>;
};
