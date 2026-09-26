import { useTranslation } from 'react-i18next';


import { UserRow } from './UserRow';
import { UsersTableSkeleton } from './UsersTableSkeleton';

import type { UsersTableProps } from './UsersTable.types';

export function UsersTable({
  users,
  isLoading,
  currentUserId,
  pendingUserId,
  onToggleRole,
  onToggleStatus,
}: UsersTableProps) {
  const { t } = useTranslation('users');

  if (isLoading) return <UsersTableSkeleton />;

  return (
    <div className="overflow-x-auto rounded-12 border border-soft-light bg-white">
      <table className="w-full">
        <thead>
          <tr className="bg-weak">
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colEmail')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colName')}
            </th>
            <th className="w-px p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colRole')}
            </th>
            <th className="w-px p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colStatus')}
            </th>
            <th className="w-px p-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              isPending={pendingUserId === user.id}
              onToggleRole={onToggleRole}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
