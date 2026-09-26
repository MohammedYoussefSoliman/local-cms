import { cn } from '../../functions';

import { badgeVariants } from './Badge.variants';

import type { BadgeProps } from './Badge.types';


export function Badge({
  disabled,
  variant,
  color,
  size,
  numeric,
  className,
  children,
  withDot,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        badgeVariants({
          variant,
          size,
          color,
          numeric,
          state: disabled ? 'disabled' : 'default',
        }),
        className,
      )}
      {...props}
    >
      {withDot && (
        <div
          data-slot="dot"
          // `me-0.5` on top of the base `gap-0.5` puts the label 16px from the
          // leading edge, matching the design's "With Dot" type.
          className="me-0.5 size-1 shrink-0 rounded-full bg-current"
        />
      )}
      {children}
    </div>
  );
}
