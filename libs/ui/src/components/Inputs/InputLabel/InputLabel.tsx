import { cn } from '../../../functions';

import type { InputLabelProps } from './InputLabel.types';

export function InputLabel({
  label,
  required,
  optional,
  optionalText,
  tip,
  className,
  ...props
}: InputLabelProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-1 text-label-sm text-strong',
        className,
      )}
      {...props}
    >
      {label}
      {required && <span className="text-error-base">*</span>}
      {optional && !!optionalText && (
        <span className="text-paragraph-xs text-sub-dark">{optionalText}</span>
      )}
      {!!tip && <span className="text-paragraph-xs text-sub-dark">{tip}</span>}
    </label>
  );
}
