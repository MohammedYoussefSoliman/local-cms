import { cn } from '../../functions';
import { Pagination } from '../Pagination';

import { TableBody, TableHeader } from './components';

import type { TableProps } from './Table.types';


/**
 * Only the table scrolls — the pager stays pinned below it whenever the wrapper
 * gives this component a bounded height.
 *
 * Column widths and alignment come from the `size`/`align` presets rather than
 * per-cell classes, so a header can never drift out of step with its body.
 */
export function Table<T>({
  data,
  columns,
  isLoading,
  loadingRows,
  noDataComponent,
  renderRow,
  meta,
  paginationDescription,
  className,
  layout = 'auto',
  colgroup,
}: TableProps<T>) {
  const isEmpty = !isLoading && data.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className={cn('w-full', layout === 'fixed' && 'table-fixed', className)}
        >
          {colgroup}
          <TableHeader<T> columns={columns} />
          {!isEmpty && (
            <TableBody<T>
              data={data}
              columns={columns}
              renderRow={renderRow}
              isLoading={isLoading}
              loadingRows={loadingRows}
              meta={meta}
            />
          )}
        </table>
        {isEmpty && (noDataComponent ?? null)}
      </div>

      {!isEmpty && !!meta && meta.lastPage > 1 && (
        <div className="mt-3.5 flex w-full flex-col items-center justify-between gap-2 md:flex-row">
          {!!paginationDescription && (
            <p className="w-fit whitespace-nowrap text-paragraph-sm text-sub-dark">
              {paginationDescription}
            </p>
          )}
          <Pagination
            currentPage={meta.currentPage}
            lastPage={meta.lastPage}
            onPageChange={meta.onPageChange}
          />
        </div>
      )}
    </div>
  );
}
