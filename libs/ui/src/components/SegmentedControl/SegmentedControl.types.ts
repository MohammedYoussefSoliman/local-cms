import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type SegmentedControlProps = {
  value: string;
  icon?: ReactNode;
  isActive?: boolean;
  onChange?: (value: string) => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onChange'>

export type SegmentedControlGroupProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}
