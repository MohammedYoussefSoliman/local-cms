import type { ReactElement, ReactNode } from 'react';

export type TableColumnSize =
  | 'actions'
  | 'badge'
  | 'date'
  | 'compact'
  | 'medium'
  | 'wide'
  | 'wider';

export type TableColumnAlign = 'start' | 'center' | 'end';

export type TableFormatter<T> = (args: {
  value: unknown;
  index: number;
  rowCount: number;
  rowData: T;
}) => ReactNode;

export type TableColumn<T> = {
  label: ReactNode;
  /** Dot-path into the row; omitted when `formatter` derives the cell itself. */
  dataKey?: keyof T & string;
  formatter?: TableFormatter<T>;
  /** Width preset — see `TABLE_COLUMN_SIZE_CLASSNAMES`. */
  size?: TableColumnSize;
  /** Defaults to `end` for `actions` columns, `start` otherwise. */
  align?: TableColumnAlign;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
};

export type TablePaginationMeta = {
  currentPage: number;
  lastPage: number;
  perPage?: number;
  onPageChange: (page: number) => void;
};

export type TableProps<T> = {
  data: T[];
  columns: TableColumn<T>[];
  isLoading?: boolean;
  /** How many skeleton rows to draw while loading. Match the page size. */
  loadingRows?: number;
  /** Shown instead of the body when `data` is empty and not loading. */
  noDataComponent?: ReactElement;
  /** Replaces the default `<tr>`, for rows that need their own markup. */
  renderRow?: (args: {
    item: T;
    index: number;
    rowCount: number;
  }) => ReactElement;
  meta?: TablePaginationMeta;
  /** Localized "Page 1 of 4" strip beside the pager. */
  paginationDescription?: ReactNode;
  className?: string;
  /** `fixed` honours the column widths exactly and makes truncation predictable. */
  layout?: 'auto' | 'fixed';
  colgroup?: ReactNode;
};
