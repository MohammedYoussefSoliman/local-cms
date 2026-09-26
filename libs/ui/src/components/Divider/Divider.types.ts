import type { ReactNode } from 'react';

export type DividerVariant = 'split' | 'bar';

export type DividerProps = {
  children?: ReactNode;
  variant?: DividerVariant;
  className?: string;
  lineClassName?: string;
  contentClassName?: string;
}
