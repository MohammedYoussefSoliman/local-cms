import type { ReactNode } from 'react';
import type {
  FieldValues,
  UseFormProps,
  UseFormReturn,
} from 'react-hook-form';

export type FormProps<TValues extends FieldValues> = UseFormProps<TValues> & {
  onSubmit?: (values: TValues) => void | Promise<void>;
  /**
   * A plain node, or a render function when the caller needs `control` and
   * `handleSubmit` in the same scope — a form inside a `Modal` puts its submit
   * button in the footer, outside the children tree.
   */
  children: ReactNode | ((methods: UseFormReturn<TValues>) => ReactNode);
  className?: string;
};
