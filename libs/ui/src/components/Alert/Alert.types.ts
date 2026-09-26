import type { ComponentProps, ReactNode } from 'react';

export type AlertStatus = 'information' | 'success' | 'warning' | 'error';

export type AlertProps = {
  status?: AlertStatus;
  title?: ReactNode;
  /** `false` drops the icon entirely; a node replaces the default one. */
  icon?: ReactNode | false;
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
} & Omit<ComponentProps<'div'>, 'title'>
