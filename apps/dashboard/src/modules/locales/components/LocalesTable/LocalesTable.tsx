
import { Badge, LtrText } from '@cms/ui';
import { useTranslation } from 'react-i18next';


import { LocaleRowActions } from './LocaleRowActions';
import { LocalesTableSkeleton } from './LocalesTableSkeleton';

import type { LocalesTableProps } from './LocalesTable.types';

export function LocalesTable({
  rows,
  isLoading,
  appName,
  canManage,
  togglingCode,
  onToggle,
}: LocalesTableProps) {
  const { t } = useTranslation('locales');

  if (isLoading) return <LocalesTableSkeleton />;

  return (
    <div className="overflow-x-auto rounded-12 border border-soft-light bg-white">
      <table className="w-full">
        <thead>
          <tr className="bg-weak">
            <th className="w-24 p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colCode')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colName')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colNativeName')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colDirection')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colStatus')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colFallback')}
            </th>
            <th className="w-px p-3" />
          </tr>
        </thead>

        <tbody>
          {rows.map(({ locale, appLocale }) => (
            <tr
              key={locale.id}
              className="border-b border-soft-light last:border-b-0 hover:bg-weak"
            >
              <td className="p-3">
                <LtrText mono className="text-paragraph-sm text-strong">
                  {locale.code}
                </LtrText>
              </td>
              <td className="p-3 text-paragraph-sm text-strong">
                {locale.name}
              </td>
              {/* The endonym is written in its own language, so it carries its
                  own direction — not the UI's. */}
              <td className="p-3 text-paragraph-sm text-strong">
                <span dir={locale.direction}>{locale.nativeName}</span>
              </td>
              <td className="p-3 text-paragraph-sm text-sub-dark">
                {locale.direction === 'rtl'
                  ? t('directionRtl')
                  : t('directionLtr')}
              </td>
              <td className="p-3">
                {!locale.isActive ? (
                  <Badge size="md" color="gray" variant="outline">
                    {t('inactive')}
                  </Badge>
                ) : appLocale?.isEnabled ? (
                  <Badge size="md" color="green" variant="lighter">
                    {appName
                      ? t('enabledInApp', { app: appName })
                      : t('enable')}
                  </Badge>
                ) : (
                  <Badge size="md" color="gray" variant="outline">
                    {t('notEnabled')}
                  </Badge>
                )}
              </td>
              <td className="p-3">
                {appLocale?.fallbackLocaleCode ? (
                  <LtrText mono className="text-paragraph-sm text-sub-dark">
                    {appLocale.fallbackLocaleCode}
                  </LtrText>
                ) : (
                  <span className="text-paragraph-xs text-sub-dark">
                    {t('noFallback')}
                  </span>
                )}
              </td>
              <td className="w-px whitespace-nowrap p-3 text-end">
                <LocaleRowActions
                  row={{ locale, appLocale }}
                  canManage={canManage}
                  isToggling={togglingCode === locale.code}
                  onToggle={onToggle}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
