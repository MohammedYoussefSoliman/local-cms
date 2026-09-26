import type { TextDirection } from '@cms/domain';

export type ValueTextProps = {
  value: string;
  /**
   * The direction of the LOCALE this value belongs to — from the locale row,
   * never from the UI language and never inferred from the code.
   */
  direction: TextDirection;
  /** Clamp to two lines, for table cells. */
  truncate?: boolean;
  className?: string;
}
