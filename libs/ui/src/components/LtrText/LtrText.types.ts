import type { ComponentProps } from 'react';

export type LtrTextProps = {
  /** `true` when the string is a code/key/path and should also use the mono face. */
  mono?: boolean;
} & ComponentProps<'span'>
