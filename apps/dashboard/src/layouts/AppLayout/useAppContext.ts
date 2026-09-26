import { useOutletContext } from 'react-router-dom';

import type { AppOutletContext } from './AppLayout.types';

/** Typed reader for the outlet context `AppLayout` provides. */
export function useAppContext(): AppOutletContext {
  return useOutletContext<AppOutletContext>();
}
