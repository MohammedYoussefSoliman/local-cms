import type { TableColumnAlign, TableColumnSize } from '../Table.types';

/**
 * Width presets applied to a column's `<th>` and every `<td>` beneath it.
 *
 * Under the default `auto` layout, `w-px` means "shrink to the content" — the
 * browser cannot render a cell narrower than its content, so every remaining
 * pixel goes to the columns asking for it. That is what keeps an actions or
 * badge column tight while a description column absorbs the slack.
 */
export const TABLE_COLUMN_SIZE_CLASSNAMES: Record<TableColumnSize, string> = {
  /** Icon buttons at the end of a row — no more space than the buttons need. */
  actions: 'w-px whitespace-nowrap',
  /** Status chips and checkboxes — as wide as the widest chip, no wrapping. */
  badge: 'w-px whitespace-nowrap',
  /** Date / date-time stacks — bounded, never wraps mid-date. */
  date: 'w-36 whitespace-nowrap',
  /** Short scalar values: counts, codes, locale tags. */
  compact: 'w-28',
  /** Predictable single-line values: names, keys, references. */
  medium: 'w-44',
  /** Free text of unknown length — takes a share of the leftover width. */
  wide: 'w-[30%] min-w-56',
  /** Long free text: translated copy, descriptions. Outweighs `wide`. */
  wider: 'w-[45%] min-w-80',
};

export const TABLE_COLUMN_ALIGN_CLASSNAMES: Record<TableColumnAlign, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

/** Alignment used when a column sets only `size` and not `align`. */
export const TABLE_COLUMN_DEFAULT_ALIGN: Partial<
  Record<TableColumnSize, TableColumnAlign>
> = {
  actions: 'end',
};
