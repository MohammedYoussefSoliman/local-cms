import { Badge, Button, LtrText } from '@cms/ui';
import { useTranslation } from 'react-i18next';

import type { UserResponseData } from '@cms/contracts';

type UserRowProps = {
  user: UserResponseData;
  isSelf: boolean;
  isPending: boolean;
  onToggleRole: (user: UserResponseData) => void;
  onToggleStatus: (user: UserResponseData) => void;
};

const STATUS_COLOR = {
  active: 'green',
  invited: 'blue',
  disabled: 'gray',
} as const;

export function UserRow({
  user,
  isSelf,
  isPending,
  onToggleRole,
  onToggleStatus,
}: UserRowProps) {
  const { t } = useTranslation(['users', 'app']);

  function handleToggleRole() {
    onToggleRole(user);
  }

  function handleToggleStatus() {
    onToggleStatus(user);
  }

  return (
    <tr className="border-b border-soft-light last:border-b-0 hover:bg-weak">
      <td className="p-3">
        <LtrText className="text-paragraph-sm text-strong">
          {user.email}
        </LtrText>
      </td>
      <td className="p-3 text-paragraph-sm text-strong">{user.name}</td>
      <td className="w-px whitespace-nowrap p-3">
        <Badge
          size="md"
          variant="lighter"
          color={user.role === 'admin' ? 'purple' : 'gray'}
        >
          {user.role === 'admin' ? t('app:roleAdmin') : t('app:roleEditor')}
        </Badge>
      </td>
      <td className="w-px whitespace-nowrap p-3">
        <Badge size="md" variant="lighter" color={STATUS_COLOR[user.status]}>
          {t(`users:status${user.status[0].toUpperCase()}${user.status.slice(1)}`)}
        </Badge>
      </td>
      <td className="w-px whitespace-nowrap p-3 text-end">
        {isSelf ? (
          // Demoting or disabling yourself 422s on the API — it would 401 your
          // very next request. Say so instead of offering the button.
          <span className="text-paragraph-xs text-sub-dark">
            {t('users:you')}
          </span>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              color="neutral"
              loading={isPending}
              onClick={handleToggleRole}
            >
              {user.role === 'admin'
                ? t('users:makeEditor')
                : t('users:makeAdmin')}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              color={user.status === 'disabled' ? 'success' : 'error'}
              onClick={handleToggleStatus}
            >
              {user.status === 'disabled'
                ? t('users:enable')
                : t('users:disable')}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
