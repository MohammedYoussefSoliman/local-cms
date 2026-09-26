import { AlertCircle, CheckCircle2, Info, MinusCircle, XCircle } from 'lucide-react';

import { cn } from '../../functions';
import { Badge } from '../Badge';


import type {
  StatusBadgeColorMapType,
  StatusBadgeIconMapType,
  StatusBadgeProps,
} from './StatusBadge.types';

const StatusBadgeColorMap: StatusBadgeColorMapType = {
  completed: 'green',
  disabled: 'gray',
  failed: 'red',
  information: 'blue',
  pending: 'orange',
};

const ICON_SIZE = 14;

// The icons paint with `currentColor` on the label but carry their own status
// hue here, so the badge stays readable in either variant.
const StatusBadgeIconMap: StatusBadgeIconMapType = {
  completed: <CheckCircle2 size={ICON_SIZE} className="text-success-base" />,
  // Mode-invariant neutral, like the gray badge — `sub-dark` and friends invert
  // under `.dark` and would wash the icon out against a light pill.
  disabled: <MinusCircle size={ICON_SIZE} className="text-faded-soft" />,
  failed: <XCircle size={ICON_SIZE} className="text-error-base" />,
  information: <Info size={ICON_SIZE} className="text-information-base" />,
  pending: <AlertCircle size={ICON_SIZE} className="text-warning-base" />,
};

export function StatusBadge({
  status,
  className,
  text,
  light,
  withDot,
  textOnly = false,
}: StatusBadgeProps) {
  return (
    <Badge
      className={cn(
        'border-soft-light',
        '[&_[data-slot=dot]]:size-1.5',
        !withDot && 'gap-1.5',
        className,
      )}
      variant={light ? 'light' : 'outline'}
      color={StatusBadgeColorMap[status]}
      size="md"
      withDot={textOnly ? false : withDot}
    >
      {!textOnly && !withDot && StatusBadgeIconMap[status]}
      <span className={cn(!light && 'text-sub-dark')}>{text}</span>
    </Badge>
  );
}
