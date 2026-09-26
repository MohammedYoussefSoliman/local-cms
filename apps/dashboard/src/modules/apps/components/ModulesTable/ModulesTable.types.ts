import type { TranslationModuleResponseData } from '@cms/contracts';

export type ModulesTableProps = {
  modules: TranslationModuleResponseData[];
  isLoading: boolean;
  /** The app's slug, for the runtime endpoint column. */
  appSlug: string | undefined;
  onOpen: (module: TranslationModuleResponseData) => void;
}
