import type { ReactNode } from 'react';

export type PageHeaderProps = {
  /** Small muted line above the title — the app name, or a breadcrumb trail. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** The action row, pinned to the reading end on wide viewports. */
  actions?: ReactNode;
  className?: string;
}
