import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/** How the translation editor lays out a module's keys. */
export type EditorLayout = 'table' | 'cards' | 'focus';

type UiStore = {
  // --- State ---
  /**
   * The app the sidebar is scoped to. Persisted because returning to the
   * dashboard and landing on a different product than you left is disorienting
   * — but it is only a *hint*: the route's `:appId` always wins, and this is
   * what a bare `/` redirects to.
   */
  selectedAppId: string | null;
  editorLayout: EditorLayout;
  // --- Actions ---
  setSelectedAppId: (appId: string | null) => void;
  setEditorLayout: (layout: EditorLayout) => void;
};

export const useUiStore = create<UiStore>()(
  devtools(
    persist(
      (set) => ({
        selectedAppId: null,
        editorLayout: 'table',
        setSelectedAppId: (selectedAppId) => set({ selectedAppId }),
        setEditorLayout: (editorLayout) => set({ editorLayout }),
      }),
      { name: 'cms-dashboard-ui-storage' },
    ),
    { name: 'UI Store' },
  ),
);
