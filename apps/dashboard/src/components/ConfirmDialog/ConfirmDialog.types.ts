import type { ButtonProps, ModalProps } from '@cms/ui';

import type { ReactNode } from 'react';


export type ConfirmDialogProps = {
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmColor?: ButtonProps['color'];
  isPending?: boolean;
  onConfirm: () => void;
  type?: ModalProps['type'];
} & Pick<ModalProps, 'open'>
