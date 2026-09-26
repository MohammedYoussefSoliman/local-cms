import type { Root } from '@radix-ui/react-dialog';
import type { ComponentProps, ReactNode } from 'react';


export type DrawerProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Pinned action row at the bottom of the panel. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  closeLabel?: string;
} & ComponentProps<typeof Root>
