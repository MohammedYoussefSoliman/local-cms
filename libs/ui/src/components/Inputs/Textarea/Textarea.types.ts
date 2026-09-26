import type { ComponentPropsWithRef, ReactNode } from 'react';

export type TextareaProps = {
  label?: string;
  helper?: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  optionalText?: string;
  tip?: string;
  /** Rendered between the label and the box — status pills, locale markers. */
  labelAddon?: ReactNode;
} & ComponentPropsWithRef<'textarea'>
