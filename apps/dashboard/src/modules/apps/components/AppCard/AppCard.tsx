import { LtrText, cn } from '@cms/ui';
import { AppWindow } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppResponseData } from '@cms/contracts';

export type AppCardProps = {
  app: AppResponseData;
  isActive: boolean;
  onSelect: (appId: string) => void;
};

export function AppCard({ app, isActive, onSelect }: AppCardProps) {
  const { t } = useTranslation('apps');

  function handleClick() {
    onSelect(app.id);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex cursor-pointer flex-col gap-2.5 rounded-12 border bg-white p-4 text-start transition-colors hover:bg-weak',
        isActive ? 'border-primary-base' : 'border-soft-light',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-label-md text-strong">{app.name}</span>
        <AppWindow size={18} className="shrink-0 text-sub-dark" />
      </div>

      {/* A runtime path is a technical string — LTR in every locale. */}
      <LtrText mono className="truncate text-paragraph-xs text-primary-base">
        /v1/apps/{app.slug}
      </LtrText>

      <div className="flex flex-wrap items-center gap-2 text-paragraph-xs text-sub-dark">
        <span>
          {t('defaultLocale')}:{' '}
          <LtrText mono>{app.defaultLocaleCode}</LtrText>
        </span>
      </div>
    </button>
  );
}
