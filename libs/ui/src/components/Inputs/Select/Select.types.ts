import type { ReactNode } from 'react';

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  helper?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  size?: 'md' | 'sm' | 'xs';
  className?: string;
  /** Classes for the portaled content panel. */
  contentClassName?: string;
}
