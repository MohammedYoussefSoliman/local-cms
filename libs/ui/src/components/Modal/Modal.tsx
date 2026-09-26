
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { cn } from '../../functions';

import type { ModalProps, ModalType } from './Modal.types';
import type { ReactNode } from 'react';

const TYPE_ICON: Record<ModalType, ReactNode> = {
  basic: null,
  info: <Info size={20} className="text-information-base" />,
  error: <XCircle size={20} className="text-error-base" />,
  warning: <AlertCircle size={20} className="text-warning-base" />,
  success: <CheckCircle2 size={20} className="text-success-base" />,
};

const TYPE_ICON_BG: Record<ModalType, string> = {
  basic: '',
  info: 'bg-information-lighter',
  error: 'bg-error-lighter',
  warning: 'bg-warning-lighter',
  success: 'bg-success-lighter',
};

/**
 * Radix portals the panel to `document.body`, outside the page tree. It
 * inherits `dir` from `<html>`, so `ms`/`me` and `start`/`end` mirror — but any
 * `dir` set on a page wrapper never reaches it. Open every modal in Arabic
 * before calling it done (`.claude/rules/global-rtl-direction.md` Rule 5).
 */
export function Modal({
  title,
  headerSubtitle,
  icon,
  type,
  hideCloseButton,
  footer,
  children,
  className,
  contentProps,
  closeLabel = 'Close',
  ...props
}: ModalProps) {
  const hasHeader = !!title || !hideCloseButton;

  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-800/25 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-statics-black/70" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          {...contentProps}
          className={cn(
            'fixed start-1/2 top-1/2 z-50 flex max-h-[90vh] w-[27.5rem] max-w-[95%] -translate-y-1/2 flex-col rounded-20 bg-white shadow-regular-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:border dark:border-soft-light',
            // `-translate-x-1/2` is physical, and RTL flips which edge `start`
            // measures from — so the transform has to flip with it.
            'rtl:translate-x-1/2 ltr:-translate-x-1/2',
            className,
          )}
        >
          {hasHeader && (
            <div className="flex items-center gap-3 rounded-t-20 border-b border-soft-light px-5 py-4">
              {!!title && (
                <div className="flex grow items-start gap-3.5">
                  {icon ??
                    (type && type !== 'basic' ? (
                      <span
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-8',
                          headerSubtitle && TYPE_ICON_BG[type],
                        )}
                      >
                        {TYPE_ICON[type]}
                      </span>
                    ) : null)}
                  <div className="flex flex-col gap-1">
                    <DialogPrimitive.Title className="text-label-md text-strong">
                      {title}
                    </DialogPrimitive.Title>
                    {!!headerSubtitle && (
                      <DialogPrimitive.Description className="text-paragraph-xs text-sub-dark">
                        {headerSubtitle}
                      </DialogPrimitive.Description>
                    )}
                  </div>
                </div>
              )}
              {!hideCloseButton && (
                <DialogPrimitive.Close
                  type="button"
                  className="ms-auto cursor-pointer rounded-full p-1 text-sub-dark transition-colors hover:bg-soft-light focus:outline-none focus-visible:ring-2 focus-visible:ring-faded-light"
                >
                  <X size={18} />
                  <span className="sr-only">{closeLabel}</span>
                </DialogPrimitive.Close>
              )}
            </div>
          )}

          {!!children && (
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          )}

          {!!footer && (
            <div className="border-t border-soft-light px-5 py-4">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}