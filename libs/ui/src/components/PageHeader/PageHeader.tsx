import { cn } from '../../functions';

import type { PageHeaderProps } from './PageHeader.types';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {!!eyebrow && (
            <div className="text-paragraph-xs text-sub-dark">{eyebrow}</div>
          )}
          <h1 className="text-title-lg text-strong">{title}</h1>
        </div>
        {!!actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {!!description && (
        <p className="max-w-2xl text-paragraph-sm text-sub-dark">
          {description}
        </p>
      )}
    </header>
  );
}
