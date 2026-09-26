import { cn } from '../../functions';

import type { CardProps } from './Card.types';

/**
 * The surface every panel in the dashboard sits on. Skeletons reuse the same
 * wrapper classes so the loading-to-content transition does not shift the
 * layout — see `.claude/rules/global-skeleton-loading.md` Rule 5.
 */
export function Card({
  kicker,
  title,
  action,
  description,
  className,
  children,
  ...props
}: CardProps) {
  const hasHeader = !!kicker || !!title || !!action || !!description;

  return (
    <div
      className={cn(
        'flex flex-col gap-3.5 rounded-12 border border-soft-light bg-white p-5',
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <div className="flex flex-col gap-1">
          {!!kicker && (
            <span className="text-subheading-2xs uppercase text-sub-dark">
              {kicker}
            </span>
          )}
          {(!!title || !!action) && (
            <div className="flex items-center justify-between gap-2">
              {!!title && (
                <h3 className="text-label-lg text-strong">{title}</h3>
              )}
              {action}
            </div>
          )}
          {!!description && (
            <p className="text-paragraph-sm text-sub-dark">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
