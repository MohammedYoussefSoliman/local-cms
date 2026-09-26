import { LtrText } from '@cms/ui';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';


export function SidebarBrand() {
  const { t } = useTranslation('app');

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-8 bg-primary-lighter text-primary-base">
        <Languages size={18} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-label-sm text-strong">
          {t('appName')}
        </span>
        <LtrText className="truncate text-paragraph-xs text-sub-dark">
          Localization CMS
        </LtrText>
      </div>
    </div>
  );
}
