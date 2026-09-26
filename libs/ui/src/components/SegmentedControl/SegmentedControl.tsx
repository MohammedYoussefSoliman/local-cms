
import { cn } from '../../functions';

import type { SegmentedControlProps } from './SegmentedControl.types';
import type { MouseEvent } from 'react';

export function SegmentedControl({
  className,
  value,
  icon,
  isActive,
  disabled = false,
  onChange,
  onClick,
  children,
  ...props
}: SegmentedControlProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onChange?.(value);
    onClick?.(event);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isActive ?? false}
      onClick={handleClick}
      className={cn(
        'flex flex-1 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-8 px-3 py-1.5 text-label-sm transition-all duration-200 outline-none',
        // Primary fill, not `bg-white`: the track sits on `bg-weak`, but the
        // control is often dropped inside a white surface (the sidebar), where
        // a white "active" state is invisible against its own container.
        isActive
          ? 'bg-primary-base text-statics-white shadow-regular-xs'
          : 'bg-transparent text-sub-dark hover:text-strong',
        disabled && 'pointer-events-none cursor-not-allowed text-sub-light',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
