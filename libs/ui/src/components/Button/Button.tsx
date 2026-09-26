import { Loader2 } from 'lucide-react';

import { cn } from '../../functions';

import { buttonVariants } from './Button.variants';

import type { ButtonProps } from './Button.types';


export function Button({
  className,
  loading,
  children,
  variant,
  size,
  color,
  isLink,
  ...props
}: ButtonProps) {
  const isIconButton = !!size?.includes('icon');
  const Component = isLink ? 'a' : 'button';
  const isDisabled = props.disabled || !!loading;

  const label = typeof loading === 'string' ? loading : children;

  return (
    <Component
      {...(props as ComponentProps)}
      disabled={isDisabled}
      className={cn(
        buttonVariants({
          variant,
          size,
          color,
          state: isDisabled ? 'disabled' : 'default',
        }),
        loading && 'cursor-not-allowed',
        className,
      )}
    >
      {!!loading && <Loader2 className="size-4 shrink-0 animate-spin" />}
      {/* An icon button has no room for both; the spinner replaces the icon. */}
      {(!isIconButton || !loading) && label}
    </Component>
  );
}

/**
 * `ComponentProps<any>` in one place rather than at the spread site, so the
 * button/anchor union does not leak `any` into every consumer.
 */
type ComponentProps = Record<string, unknown>;
