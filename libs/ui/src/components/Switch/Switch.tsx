import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '../../functions';

import type { SwitchProps } from './Switch.types';

/**
 * The thumb's travel is a physical translate, so it has to be declared per
 * direction — there is no logical `translate-x`. Everything else mirrors on its
 * own.
 */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'group peer inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full px-0.5 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-faded-light data-[state=checked]:bg-primary-base data-[state=unchecked]:bg-soft-light hover:data-[state=checked]:bg-primary-dark hover:data-[state=unchecked]:bg-sub-medium disabled:cursor-not-allowed disabled:border disabled:border-soft-light',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none flex size-3 items-center justify-center rounded-full bg-white shadow-regular-xs ring-0 transition-transform group-active:scale-90 data-[state=unchecked]:translate-x-0 ltr:data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4"
      />
    </SwitchPrimitive.Root>
  );
}
