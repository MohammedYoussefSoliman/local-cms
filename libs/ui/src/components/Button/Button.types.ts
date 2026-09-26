import type { buttonVariants } from './Button.variants';
import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps, PropsWithChildren } from 'react';



/** `state` is derived from `disabled`; callers never set it directly. */
type ButtonVariants = Omit<VariantProps<typeof buttonVariants>, 'state'>;

type ButtonCommonProps = PropsWithChildren<ButtonVariants> & {
  /**
   * Swaps the label for a spinner and disables the control. A string replaces
   * the label with that text beside the spinner.
   */
  loading?: boolean | string;
};

export type ButtonAsButton = ButtonCommonProps &
  Omit<ComponentProps<'button'>, 'color'> & { isLink?: false };

export type ButtonAsLink = ButtonCommonProps &
  Omit<ComponentProps<'a'>, 'color'> & { isLink: true; disabled?: boolean };

export type ButtonProps = ButtonAsButton | ButtonAsLink;
