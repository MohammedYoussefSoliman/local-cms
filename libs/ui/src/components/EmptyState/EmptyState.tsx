import { cn } from '../../functions';

import type { EmptyStateProps } from './EmptyState.types';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      {!!icon && <span className="text-soft-medium">{icon}</span>}
      <p className="text-label-md text-strong">{title}</p>
      {!!description && (
        <p className="max-w-md text-paragraph-sm text-sub-dark">
          {description}
        </p>
      )}
      {!!action && <div className="mt-2">{action}</div>}
    </div>
  );
}
