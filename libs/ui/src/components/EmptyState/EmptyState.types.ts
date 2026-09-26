import type { ReactNode } from 'react';

export type EmptyStateProps = {
  /** A symmetric icon — status glyphs never mirror (RTL Rule 3). */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}
