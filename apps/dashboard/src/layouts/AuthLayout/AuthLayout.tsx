import { LtrText } from '@cms/ui';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';


import type { ReactNode } from 'react';

/**
 * The shell every unauthenticated screen sits in. Deliberately plain: this is
 * the one page that has to render when the API is down, so it depends on
 * nothing but bundled strings.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('app');

  return (
    <main className="flex min-h-dvh items-center justify-center bg-weak p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-8 bg-primary-lighter text-primary-base">
            <Languages size={20} />
          </span>
          <div className="flex flex-col">
            <span className="text-label-md text-strong">{t('appName')}</span>
            <LtrText className="text-paragraph-xs text-sub-dark">
              Localization CMS
            </LtrText>
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
