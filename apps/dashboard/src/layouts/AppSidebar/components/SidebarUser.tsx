import { Avatar, AvatarFallback, Button, LtrText, Tooltip } from '@cms/ui';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';


import { useAuthStore } from '@/store';

/**
 * The signed-in identity, pinned to the bottom of the rail.
 *
 * The email is isolated with `LtrText`: a Latin address dropped bare into an
 * RTL column is re-ordered around its `@` and its dots.
 */
export function SidebarUser({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation('app');
  const user = useAuthStore((state) => state.user);

  const initials = (user?.name ?? user?.email ?? '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <Avatar>
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <LtrText className="truncate text-paragraph-xs text-strong">
          {user?.email}
        </LtrText>
        <span className="text-paragraph-xs text-sub-dark">
          {user?.role === 'admin' ? t('roleAdmin') : t('roleEditor')}
        </span>
      </div>
      <Tooltip content={t('signOut')}>
        <Button
          type="button"
          variant="ghost"
          color="neutral"
          size="icon-xs"
          onClick={onSignOut}
          aria-label={t('signOut')}
        >
          {/* Directional: it points out of the app, along the reading flow. */}
          <LogOut size={16} className="rtl:-scale-x-100" />
        </Button>
      </Tooltip>
    </div>
  );
}
