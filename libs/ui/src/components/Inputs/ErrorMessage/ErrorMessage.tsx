import { AlertCircle } from 'lucide-react';

import { cn } from '../../../functions';

import type { ErrorMessageProps } from './ErrorMessage.types';

export function ErrorMessage({ error, icon, className }: ErrorMessageProps) {
  return (
    <p
      role="alert"
      className={cn(
        'flex items-center gap-1 text-paragraph-xs text-error-base',
        className,
      )}
    >
      {icon ?? <AlertCircle size={14} className="shrink-0" />}
      {error}
    </p>
  );
}
