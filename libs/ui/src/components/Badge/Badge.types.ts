import type { badgeVariants } from './Badge.variants';
import type { VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';



type BadgeVariants = Omit<VariantProps<typeof badgeVariants>, 'state'>;

export type BadgeProps = {
  disabled?: boolean;
  /** Renders a leading dot before the label. */
  withDot?: boolean;
} & BadgeVariants & Omit<HTMLAttributes<HTMLDivElement>, 'color'>
