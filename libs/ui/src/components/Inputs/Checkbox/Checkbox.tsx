import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';

import { cn } from '../../../functions';

import type { CheckboxProps } from './Checkbox.types';

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-4 border border-sub-light bg-white outline-none transition-colors hover:border-primary-base focus-visible:ring-2 focus-visible:ring-faded-light data-[state=checked]:border-primary-base data-[state=checked]:bg-primary-base data-[state=indeterminate]:border-primary-base data-[state=indeterminate]:bg-primary-base disabled:cursor-not-allowed disabled:bg-weak',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-statics-white">
        {props.checked === 'indeterminate' ? (
          <Minus size={12} strokeWidth={3} />
        ) : (
          <Check size={12} strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
