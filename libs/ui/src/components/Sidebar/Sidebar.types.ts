import type { ReactNode } from 'react';

export type SidebarNavItem = {
  /** Stable id, used as the React key and by the active check. */
  key: string;
  label: string;
  icon?: ReactNode;
  /** Rendered at the reading end of the row — a count, a dot. */
  badge?: ReactNode;
  isActive?: boolean;
  onClick?: () => void;
};

export type SidebarProps = {
  /** Brand block at the top. */
  header?: ReactNode;
  /** Free slot under the header — the app switcher lives here. */
  toolbar?: ReactNode;
  items: SidebarNavItem[];
  /** Pinned to the bottom: the signed-in user, sign out. */
  footer?: ReactNode;
  className?: string;
}
