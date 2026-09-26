import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '../../functions';

import type { DrawerProps } from './Drawer.types';

/**
 * A side panel anchored to the reading END of the viewport.
 *
 * The close control is `end-*`, not `right-*`. Pinning it to `right-4` is what
 * put it on top of every RTL drawer's title in the frontend monorepo — the bug
 * `.claude/rules/global-rtl-direction.md` Rule 1 exists for. Absolutely
 * positioned affordances are where this hides, because flex rows mirror on
 * their own and mask the habit.
 */
export function Drawer({
  title,
  subtitle,
  footer,
  children,
  className,
  closeLabel = 'Close',
  ...props
}: DrawerProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-800/25 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-statics-black/70" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'fixed inset-y-0 end-0 z-50 flex w-[26rem] max-w-full flex-col border-s border-soft-light bg-white shadow-regular-lg duration-200',
            'data-[state=closed]:animate-out data-[state=open]:animate-in',
            // The slide direction is physical, so it has to be declared per
            // direction; `slide-in-from-end` does not exist.
            'ltr:data-[state=closed]:slide-out-to-right ltr:data-[state=open]:slide-in-from-right',
            'rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left',
            className,
          )}
        >
          <div className="flex items-start gap-2 border-b border-soft-light px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogPrimitive.Title asChild>
                <div className="text-label-md text-strong">{title}</div>
              </DialogPrimitive.Title>
              {!!subtitle && (
                <DialogPrimitive.Description asChild>
                  <div className="text-paragraph-xs text-sub-dark">
                    {subtitle}
                  </div>
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              type="button"
              className="shrink-0 cursor-pointer rounded-full p-1 text-sub-dark transition-colors hover:bg-soft-light focus:outline-none focus-visible:ring-2 focus-visible:ring-faded-light"
            >
              <X size={18} />
              <span className="sr-only">{closeLabel}</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {!!footer && (
            <div className="border-t border-soft-light px-5 py-4">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
