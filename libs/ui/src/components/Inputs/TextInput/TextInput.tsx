import { cn } from '../../../functions';
import { ErrorMessage } from '../ErrorMessage';
import { HelperMessage } from '../HelperMessage';
import { InputLabel } from '../InputLabel';

import { inputVariants } from './TextInput.variants';

import type { TextInputProps } from './TextInput.types';


export function TextInput({
  label,
  helper,
  error,
  required,
  optional,
  optionalText,
  tip,
  prefixComponent,
  suffixComponent,
  size,
  className,
  inputClassName,
  id,
  ...props
}: TextInputProps) {
  // `data-state` on the group is what lets the box, the placeholder and the
  // ring all react to one flag instead of each recomputing it.
  return (
    <div
      data-state={props.disabled ? 'disabled' : error ? 'error' : undefined}
      className="group flex flex-col gap-1.5"
    >
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
      <div className={cn(inputVariants({ size }), className)}>
        {!!prefixComponent && (
          <span data-slot="prefix" className="flex shrink-0 text-sub-dark">
            {prefixComponent}
          </span>
        )}
        <input
          id={id}
          data-slot="input"
          className={cn(
            'w-full bg-transparent text-paragraph-sm text-strong outline-none placeholder:text-soft-medium group-data-[state=disabled]:cursor-not-allowed group-data-[state=disabled]:text-sub-light',
            inputClassName,
          )}
          {...props}
        />
        {!!suffixComponent && (
          <span data-slot="suffix" className="flex shrink-0 text-sub-dark">
            {suffixComponent}
          </span>
        )}
      </div>
      {error ? (
        <ErrorMessage error={error} />
      ) : helper ? (
        <HelperMessage message={helper} />
      ) : null}
    </div>
  );
}
