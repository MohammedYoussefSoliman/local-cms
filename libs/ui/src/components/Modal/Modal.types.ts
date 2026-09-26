import type { Content, Root } from '@radix-ui/react-dialog';
import type { ComponentProps, ReactNode } from 'react';


export type ModalType = 'basic' | 'error' | 'warning' | 'success' | 'info';

export type ModalProps = {
  title?: string;
  headerSubtitle?: ReactNode;
  icon?: ReactNode;
  type?: ModalType;
  hideCloseButton?: boolean;
  /** Rendered in the bordered strip at the bottom — usually the action row. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentProps?: Partial<ComponentProps<typeof Content>>;
  /** Localized label for the close button's screen-reader text. */
  closeLabel?: string;
} & ComponentProps<typeof Root>
