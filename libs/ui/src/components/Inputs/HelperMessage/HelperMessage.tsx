import { cn } from '../../../functions';

import type { HelperMessageProps } from './HelperMessage.types';

export function HelperMessage({ message, className }: HelperMessageProps) {
  return (
    <p className={cn('text-paragraph-xs text-sub-dark', className)}>
      {message}
    </p>
  );
}
