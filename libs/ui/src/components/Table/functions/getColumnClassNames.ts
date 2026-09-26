import { cn } from '../../../functions';
import {
  TABLE_COLUMN_ALIGN_CLASSNAMES,
  TABLE_COLUMN_DEFAULT_ALIGN,
  TABLE_COLUMN_SIZE_CLASSNAMES,
} from '../constants';

import type { TableColumn } from '../Table.types';


/**
 * Resolves the width and alignment classes a column contributes to its cells.
 * The header and the body call this with the same column so the two stay in
 * step — a header that sizes itself independently is how columns drift apart.
 */
export function getColumnClassNames<T>(column: TableColumn<T>): string {
  const { size, align } = column;
  const resolvedAlign =
    align ?? (size ? TABLE_COLUMN_DEFAULT_ALIGN[size] : undefined);

  return cn(
    size && TABLE_COLUMN_SIZE_CLASSNAMES[size],
    resolvedAlign && TABLE_COLUMN_ALIGN_CLASSNAMES[resolvedAlign],
    column.className,
  );
}
