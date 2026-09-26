import { Badge } from '@cms/ui';

import { useGetAppDraftsCount } from '../../services';

/**
 * The unpublished count beside the sidebar's Drafts item.
 *
 * Renders `null` at zero, and `null` while loading — a deliberate exception to
 * `.claude/rules/global-skeleton-loading.md` Rule 1. The badge is absent at
 * zero anyway, so a pulsing pill that resolves to nothing would be a flash of
 * phantom work on every navigation.
 */
export function DraftsNavBadge({ appId }: { appId: string | undefined }) {
  const { count, isLoading } = useGetAppDraftsCount(appId);

  if (isLoading || count === 0) return null;

  return (
    <Badge numeric size="md" color="purple" variant="lighter">
      {count}
    </Badge>
  );
}
