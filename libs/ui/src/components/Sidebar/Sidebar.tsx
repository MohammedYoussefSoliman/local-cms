import { cn } from '../../functions';

import { SidebarItem } from './components';

import type { SidebarProps } from './Sidebar.types';


/**
 * The app's primary navigation rail.
 *
 * `border-e` rather than `border-r`: the rail sits at the reading start, so in
 * Arabic it is on the right and its divider has to move with it. Every
 * directional utility in here is logical for the same reason — the rail is the
 * single most visible place a physical `left` leaks
 * (`.claude/rules/global-rtl-direction.md` Rule 1).
 */
export function Sidebar({
  header,
  toolbar,
  items,
  footer,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex w-60 shrink-0 flex-col gap-4 border-e border-soft-light bg-white p-3',
        className,
      )}
    >
      {!!header && <div className="px-1.5 pt-1.5">{header}</div>}
      {!!toolbar && <div className="px-0.5">{toolbar}</div>}

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => (
          <SidebarItem key={item.key} item={item} />
        ))}
      </nav>

      {!!footer && (
        <div className="border-t border-soft-light px-0.5 pt-3">{footer}</div>
      )}
    </aside>
  );
}
