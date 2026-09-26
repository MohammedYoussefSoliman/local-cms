import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '../../functions';

import type {
  AvatarFallbackProps,
  AvatarImageProps,
  AvatarProps,
} from './Avatar.types';

export function Avatar({ className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        'relative flex size-8 shrink-0 overflow-hidden rounded-full',
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full', className)}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center bg-primary-lighter text-label-xs text-primary-base',
        className,
      )}
      {...props}
    />
  );
}
