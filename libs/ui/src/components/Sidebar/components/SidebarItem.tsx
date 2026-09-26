import { cn } from '../../../functions';

import type { SidebarNavItem } from '../Sidebar.types';

/**
 * Its own component so the click handler closes over the item without an
 * inline arrow in the parent's JSX.
 */
export function SidebarItem({ item }: { item: SidebarNavItem }) {
  function handleClick() {
    item.onClick?.();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={item.isActive ? 'page' : undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-8 px-2.5 py-2 text-start text-paragraph-sm transition-colors',
        item.isActive
          ? 'bg-primary-lighter text-primary-base'
          : 'text-sub-dark hover:bg-weak hover:text-strong',
      )}
    >
      {!!item.icon && <span className="shrink-0">{item.icon}</span>}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge}
    </button>
  );
}
