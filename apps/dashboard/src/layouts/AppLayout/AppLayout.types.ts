import type { AppResponseData } from '@cms/contracts';

/**
 * What every app-scoped page gets from the layout through the router outlet.
 *
 * The layout already fetches the selected app for the sidebar switcher, so
 * handing it down costs nothing — and it keeps feature modules from importing
 * each other's service hooks to learn the app's name.
 */
export type AppOutletContext = {
  appId: string;
  app: AppResponseData | undefined;
  isLoadingApp: boolean;
};
