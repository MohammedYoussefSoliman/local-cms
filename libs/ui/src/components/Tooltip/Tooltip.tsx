import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '../../functions';

import type { TooltipProps } from './Tooltip.types';

export function TooltipProvider({
  children,
}: {
  children: TooltipProps['children'];
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  disabled,
  className,
}: TooltipProps) {
  if (disabled || !content) return children;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 max-w-64 rounded-8 bg-strong px-2.5 py-1.5 text-paragraph-xs text-white shadow-regular-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0',
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-strong" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
