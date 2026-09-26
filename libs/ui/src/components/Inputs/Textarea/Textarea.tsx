import { cn } from '../../../functions';
import { ErrorMessage } from '../ErrorMessage';
import { HelperMessage } from '../HelperMessage';
import { InputLabel } from '../InputLabel';

import type { TextareaProps } from './Textarea.types';

/**
 * The translation editor's workhorse. `dir` is deliberately NOT defaulted:
 * every cell carries the direction of the locale it holds, which comes from
 * the locale row, never from the UI language.
 */
export function Textarea({
  label,
  helper,
  error,
  required,
  optional,
  optionalText,
  tip,
  labelAddon,
  className,
  id,
  ...props
}: TextareaProps) {
  return (
    <div
      data-state={props.disabled ? 'disabled' : error ? 'error' : undefined}
      className="group flex flex-col gap-1.5"
    >
      {(!!label || !!labelAddon) && (
        <div className="flex items-center justify-between gap-2">
          {!!label && (
            <InputLabel
              htmlFor={id}
              label={label}
              required={required}
              optional={optional}
              optionalText={optionalText}
              tip={tip}
            />
          )}
          {labelAddon}
        </div>
      )}
      <textarea
        id={id}
        data-slot="textarea"
        className={cn(
          'min-h-20 w-full resize-y rounded-8 border border-soft-light bg-white px-2.5 py-2 text-paragraph-sm text-strong shadow-regular-xs outline-none transition-colors placeholder:text-soft-medium hover:bg-weak focus:border-strong focus:ring-2 focus:ring-faded-light group-data-[state=disabled]:cursor-not-allowed group-data-[state=disabled]:bg-weak group-data-[state=error]:border-error-base group-data-[state=error]:focus:ring-error-lighter',
          className,
        )}
        {...props}
      />
      {error ? (
        <ErrorMessage error={error} />
      ) : helper ? (
        <HelperMessage message={helper} />
      ) : null}
    </div>
  );
}
