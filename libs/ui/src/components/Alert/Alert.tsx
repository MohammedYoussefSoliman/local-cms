
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { cn } from '../../functions';

import type { AlertProps, AlertStatus } from './Alert.types';
import type { ReactNode } from 'react';

const STATUS_CLASSES: Record<AlertStatus, string> = {
  information: 'border-information-light bg-information-lighter',
  success: 'border-success-light bg-success-lighter',
  warning: 'border-warning-light bg-warning-lighter',
  error: 'border-error-light bg-error-lighter',
};

const STATUS_ICON: Record<AlertStatus, ReactNode> = {
  information: <Info size={18} className="text-information-base" />,
  success: <CheckCircle2 size={18} className="text-success-base" />,
  warning: <AlertTriangle size={18} className="text-warning-base" />,
  error: <XCircle size={18} className="text-error-base" />,
};

/**
 * Inline, persistent status message. Use it for state the reader has to act on
 * or acknowledge in place — the "this value is live, saving publishes it"
 * banner in the translation editor is the motivating case. For something
 * transient, use `showToast`.
 */
export function Alert({
  status = 'information',
  title,
  icon,
  actions,
  onClose,
  closeLabel = 'Dismiss',
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-12 border p-3',
        STATUS_CLASSES[status],
        className,
      )}
      {...props}
    >
      {icon !== false && (
        <span className="mt-px shrink-0">{icon ?? STATUS_ICON[status]}</span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {!!title && <span className="text-label-sm text-strong">{title}</span>}
        {!!children && (
          <div className="text-paragraph-sm text-sub-dark">{children}</div>
        )}
        {!!actions && (
          <div className="mt-1 flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {!!onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 cursor-pointer rounded-4 p-0.5 text-sub-dark transition-colors hover:bg-white/60"
        >
          <X size={16} />
          <span className="sr-only">{closeLabel}</span>
        </button>
      )}
    </div>
  );
}