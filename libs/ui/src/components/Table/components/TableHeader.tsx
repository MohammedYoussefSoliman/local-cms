import { cn } from '../../../functions';
import { getColumnClassNames } from '../functions';

import type { TableColumn } from '../Table.types';


export function TableHeader<T>({ columns }: { columns: TableColumn<T>[] }) {
  return (
    <thead>
      <tr className="bg-weak">
        {columns.map((column, index) => (
          <th
            key={index}
            className={cn(
              'px-3 py-2 text-start text-label-xs font-normal text-sub-dark first:rounded-s-8 last:rounded-e-8',
              getColumnClassNames(column),
              column.headerClassName,
            )}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}
