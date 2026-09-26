import type { ComponentProps, ReactNode } from 'react';

export type CardProps = {
  /** Small uppercase eyebrow above the title. */
  kicker?: ReactNode;
  title?: ReactNode;
  /** Sits at the end of the title row — usually an icon or a button. */
  action?: ReactNode;
  description?: ReactNode;
} & Omit<ComponentProps<'div'>, 'title'>
