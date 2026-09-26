import { Badge, type BadgeProps } from '@cms/ui';
import { useTranslation } from 'react-i18next';


import type {
  DisplayStatus,
  TranslationStatusBadgeProps,
} from './TranslationStatusBadge.types';

const STATUS_COLOR: Record<DisplayStatus, BadgeProps['color']> = {
  published: 'green',
  draft: 'gray',
  in_review: 'blue',
  archived: 'gray',
  missing: 'gray',
  unsaved: 'orange',
};

const STATUS_VARIANT: Record<DisplayStatus, BadgeProps['variant']> = {
  published: 'lighter',
  draft: 'light',
  in_review: 'lighter',
  archived: 'outline',
  missing: 'outline',
  unsaved: 'lighter',
};

const STATUS_LABEL_KEY: Record<DisplayStatus, string> = {
  published: 'statusPublished',
  draft: 'statusDraft',
  in_review: 'statusInReview',
  archived: 'statusArchived',
  missing: 'statusMissing',
  unsaved: 'statusUnsaved',
};

/**
 * One place that decides what each translation status looks like. Three screens
 * render it — the editor, the drafts queue and the overview — and a per-screen
 * colour map is how "draft" ends up green in one of them.
 */
export function TranslationStatusBadge({
  status,
  className,
}: TranslationStatusBadgeProps) {
  const { t } = useTranslation('app');

  return (
    <Badge
      size="md"
      color={STATUS_COLOR[status]}
      variant={STATUS_VARIANT[status]}
      className={className}
    >
      {t(STATUS_LABEL_KEY[status])}
    </Badge>
  );
}
