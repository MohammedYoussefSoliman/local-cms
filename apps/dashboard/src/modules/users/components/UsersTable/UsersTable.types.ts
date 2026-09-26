import type { UserResponseData } from '@cms/contracts';

export type UsersTableProps = {
  users: UserResponseData[];
  isLoading: boolean;
  /** The signed-in account's id, so its own row cannot act on itself. */
  currentUserId: string | undefined;
  pendingUserId: string | null;
  onToggleRole: (user: UserResponseData) => void;
  onToggleStatus: (user: UserResponseData) => void;
}
