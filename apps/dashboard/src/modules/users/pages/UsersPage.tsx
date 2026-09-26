
import { Button, Card, EmptyState, PageHeader } from '@cms/ui';
import { UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { UserResponseData } from '@cms/contracts';

import { RequireRole } from '@/components';
import { useAuthStore } from '@/store';

import { InviteUserDialog, UsersTable } from '../components';
import {
  useGetUsers,
  useToggleUserStatus,
  useUpdateUser,
} from '../services';

function UsersPageContent() {
  const { t } = useTranslation('users');

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const currentUserId = useAuthStore((state) => state.user?.id);

  const { data, isLoading } = useGetUsers({ limit: 100 });
  const updateUser = useUpdateUser();
  const toggleStatus = useToggleUserStatus();

  const users = data?.records ?? [];

  function handleOpenInvite() {
    setIsInviteOpen(true);
  }

  async function handleToggleRole(user: UserResponseData) {
    setPendingUserId(user.id);
    try {
      await updateUser.mutateAsync({
        userId: user.id,
        role: user.role === 'admin' ? 'editor' : 'admin',
      });
    } catch {
      // The hook toasts. Demoting the last admin is a 422 the API owns.
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleToggleStatus(user: UserResponseData) {
    setPendingUserId(user.id);
    try {
      await toggleStatus.mutateAsync({
        userId: user.id,
        enable: user.status === 'disabled',
      });
    } catch {
      // Same: disabling the last active admin is refused server-side.
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        actions={
          <Button type="button" size="small" onClick={handleOpenInvite}>
            <UserPlus size={16} />
            {t('inviteUser')}
          </Button>
        }
      />

      <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        <Card title={t('roleAdminTitle')} description={t('roleAdminDescription')} />
        <Card
          title={t('roleEditorTitle')}
          description={t('roleEditorDescription')}
        />
      </div>

      {!isLoading && users.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title={t('emptyTitle')}
          className="rounded-12 border border-soft-light bg-white"
        />
      ) : (
        <UsersTable
          users={users}
          isLoading={isLoading}
          currentUserId={currentUserId}
          pendingUserId={pendingUserId}
          onToggleRole={handleToggleRole}
          onToggleStatus={handleToggleStatus}
        />
      )}

      <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
    </div>
  );
}

/**
 * Every route below is `@Roles('admin')` on the API and answers 403 regardless
 * of what renders here — the guard is a courtesy so an editor who follows a
 * link gets an explanation instead of a screen of failed requests.
 */
export function UsersPage() {
  return (
    <RequireRole role="admin">
      <UsersPageContent />
    </RequireRole>
  );
}
