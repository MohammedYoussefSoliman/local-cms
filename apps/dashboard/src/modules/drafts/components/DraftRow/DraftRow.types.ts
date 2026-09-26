import type { DraftValueRow } from '@cms/contracts';

import type { DraftPublishFailure } from '../../Drafts.types';

export type DraftRowProps = {
  row: DraftValueRow;
  isSelected: boolean;
  isPublishing: boolean;
  failure?: DraftPublishFailure;
  onToggle: (id: string) => void;
  onPublish: (row: DraftValueRow) => void;
  onPublishVersion: (row: DraftValueRow, expectedVersion: number) => void;
  onOpenInEditor: (row: DraftValueRow) => void;
}
