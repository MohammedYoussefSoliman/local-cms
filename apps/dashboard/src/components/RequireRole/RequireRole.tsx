
import { EmptyState } from '@cms/ui';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/store';

import type { RequireRoleProps } from './RequireRole.types';

/**
 * Hides an admin-only screen from an editor.
 *
 * This is a courtesy, not a security boundary — every one of these routes is
 * `@Roles('admin')` on the API and answers 403 regardless of what the client
 * renders. It exists so an editor who follows a link gets an explanation
 * instead of a screen full of failed requests.
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { t } = useTranslation('app');
  const user = useAuthStore((state) => state.user);

  if (user?.role !== role) {
    return (
      <EmptyState
        icon={<Lock size={28} />}
        title={t('adminOnly')}
        description={t('adminOnlyDescription')}
        className="py-20"
      />
    );
  }

  return children;
}
