import type { DraftsPublishResult } from '../../Drafts.types';

export type BatchResultSummaryProps = {
  result: DraftsPublishResult;
  onSelectFailed: () => void;
  onDismiss: () => void;
}
