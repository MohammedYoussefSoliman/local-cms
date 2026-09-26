import { cn } from '../../../functions';
import { Skeleton } from '../../Skeleton';
import { getCellValue, getColumnClassNames } from '../functions';

import type { TableProps } from '../Table.types';


type TableBodyProps<T> = Pick<
  TableProps<T>,
  'data' | 'columns' | 'renderRow' | 'isLoading' | 'loadingRows' | 'meta'
>;

export function TableBody<T>({
  data,
  columns,
  renderRow,
  isLoading,
  loadingRows = 8,
  meta,
}: TableBodyProps<T>) {
  if (isLoading) {
    return (
      <tbody>
        {Array.from({ length: loadingRows }).map((_, rowIndex) => (
          <tr
            key={`loading-${rowIndex}`}
            className="border-b border-soft-light last:border-b-0"
          >
            {columns.map((column, columnIndex) => (
              <td
                key={`loading-${rowIndex}-${columnIndex}`}
                className={cn('p-3', getColumnClassNames(column))}
              >
                <Skeleton className="h-3.5 rounded-4" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  }

  return (
    <tbody>
      {data.map((row, index) => {
        const rowCount = meta
          ? (meta.currentPage - 1) * (meta.perPage ?? data.length) + index + 1
          : index + 1;

        if (renderRow) return renderRow({ item: row, index, rowCount });

        return (
          <tr
            key={index}
            className="border-b border-soft-light last:border-b-0 hover:bg-weak"
          >
            {columns.map((column, columnIndex) => (
              <td
                key={columnIndex}
                className={cn(
                  'p-3 text-paragraph-sm text-strong',
                  getColumnClassNames(column),
                  column.cellClassName,
                )}
              >
                {column.formatter
                  ? column.formatter({
                      value: getCellValue(row, column.dataKey),
                      index,
                      rowCount,
                      rowData: row,
                    })
                  : (getCellValue(row, column.dataKey) as React.ReactNode)}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}
