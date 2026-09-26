import type { TranslationConflictData } from '@cms/contracts';
import type { TextDirection } from '@cms/domain';

export type DraftConflictDisclosureProps = {
  conflict: TranslationConflictData;
  /** What the queue was showing before the row moved. */
  shownValue: string;
  direction: TextDirection;
  onPublishCurrent: (expectedVersion: number) => void;
  onOpenInEditor: () => void;
  isPublishing?: boolean;
}
