import type { TextareaProps } from '../Textarea';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';


export type ControlledTextareaProps<TValues extends FieldValues> = Omit<
  TextareaProps,
  'name' | 'error' | 'value' | 'onChange' | 'defaultValue'
> & {
  name: FieldPath<TValues>;
  control?: Control<TValues>;
};
