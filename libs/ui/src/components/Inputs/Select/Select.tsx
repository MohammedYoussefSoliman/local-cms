import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '../../../functions';
import { ErrorMessage } from '../ErrorMessage';
import { HelperMessage } from '../HelperMessage';
import { InputLabel } from '../InputLabel';

import type { SelectProps } from './Select.types';

const TRIGGER_SIZES = {
  md: 'h-10',
  sm: 'h-9',
  xs: 'h-8',
} as const;

/**
 * Radix renders the panel into `document.body`, so it inherits `dir` from
 * `<html>` rather than from any page wrapper — which is exactly why
 * `useLocale` sets `dir` on the document element and not on a layout div.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  label,
  error,
  helper,
  required,
  disabled,
  name,
  id,
  size = 'md',
  className,
  contentClassName,
}: SelectProps) {
  return (
    <div
      data-state={disabled ? 'disabled' : error ? 'error' : undefined}
      className="group flex flex-col gap-1.5"
    >
      {!!label && <InputLabel htmlFor={id} label={label} required={required} />}
      <SelectPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          id={id}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-8 border border-soft-light bg-white px-2.5 text-paragraph-sm text-strong shadow-regular-xs outline-none transition-colors hover:bg-weak focus:border-strong focus:ring-2 focus:ring-faded-light data-[placeholder]:text-soft-medium disabled:cursor-not-allowed disabled:bg-weak disabled:text-sub-light',
            TRIGGER_SIZES[size],
            error && 'border-error-base focus:ring-error-lighter',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown size={16} className="shrink-0 text-sub-dark" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className={cn(
              'z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-8 border border-soft-light bg-white shadow-regular-md',
              contentClassName,
            )}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-4 px-2 py-1.5 text-paragraph-sm text-strong outline-none data-[highlighted]:bg-weak data-[disabled]:cursor-not-allowed data-[disabled]:text-sub-light"
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check size={14} className="text-primary-base" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error ? (
        <ErrorMessage error={error} />
      ) : helper ? (
        <HelperMessage message={helper} />
      ) : null}
    </div>
  );
}
