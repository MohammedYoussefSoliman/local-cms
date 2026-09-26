import type { EntryFilter } from '../../Translations.types';

export type EditorToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: EntryFilter;
  onFilterChange: (filter: EntryFilter) => void;
  /** Runtime endpoint hint, shown at the reading end of the row. */
  endpoint: string;
}
