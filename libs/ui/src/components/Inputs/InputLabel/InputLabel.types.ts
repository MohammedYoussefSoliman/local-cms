import type { ComponentProps } from 'react';

export type InputLabelProps = {
  label: string;
  /** Appends a red asterisk. */
  required?: boolean;
  /** Appends a muted "(optional)" marker. `optionalText` localizes it. */
  optional?: boolean;
  optionalText?: string;
  /** Muted hint rendered after the label, for one-line context. */
  tip?: string;
} & ComponentProps<'label'>
