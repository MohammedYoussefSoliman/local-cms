import type { inputVariants } from './TextInput.variants';
import type { VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, ReactNode } from 'react';



export type TextInputProps = {
  label?: string;
  helper?: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  optionalText?: string;
  tip?: string;
  prefixComponent?: ReactNode;
  suffixComponent?: ReactNode;
  /** Wrapper classes; `className` targets the box, not the `<input>`. */
  inputClassName?: string;
} & Omit<ComponentPropsWithRef<'input'>, 'size'> & VariantProps<typeof inputVariants>
