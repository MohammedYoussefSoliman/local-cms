import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '../../functions';

import type { PopoverProps } from './Popover.types';

export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'end',
  className,
  ...props
}: PopoverProps) {
  return (
    <PopoverPrimitive.Root {...props}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 min-w-48 rounded-12 border border-soft-light bg-white p-1 shadow-regular-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
