import type { TranslationStatus } from '@cms/domain';

/**
 * The editor shows two states the API has no status for: a locale with no row
 * at all, and a cell the user has typed into but not saved. They are UI states,
 * so they live here rather than being smuggled into `TranslationStatus`.
 */
export type DisplayStatus = TranslationStatus | 'missing' | 'unsaved';

export type TranslationStatusBadgeProps = {
  status: DisplayStatus;
  className?: string;
}
