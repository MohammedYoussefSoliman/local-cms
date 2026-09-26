import type { DraftValueRow } from '@cms/contracts';

import type { DraftPublishFailure } from '../../Drafts.types';

export type DraftsTableProps = {
  rows: DraftValueRow[];
  isLoading: boolean;
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onTogglePage: (checked: boolean) => void;
  onPublishRow: (row: DraftValueRow) => void;
  onPublishVersion: (row: DraftValueRow, expectedVersion: number) => void;
  onOpenInEditor: (row: DraftValueRow) => void;
  publishingId: string | null;
  /** The last batch's failures, keyed by value id. */
  failures: Map<string, DraftPublishFailure>;
}
