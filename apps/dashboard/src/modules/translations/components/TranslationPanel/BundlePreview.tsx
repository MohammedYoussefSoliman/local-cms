import { LtrText, cn } from '@cms/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AppLocaleResponseData, TranslationRow } from '@cms/contracts';

import { readCell } from '../../functions';

type BundlePreviewProps = {
  row: TranslationRow;
  locales: AppLocaleResponseData[];
  moduleSlug: string | undefined;
  appSlug: string | undefined;
};

/**
 * Exactly what a client application gets back for this key, per language.
 *
 * Draft and missing values are shown as absent rather than as empty strings,
 * because that is what the runtime read does: it filters on
 * `status = 'published'` in the query. Rendering a draft here would teach the
 * editor the opposite of the invariant.
 */
export function BundlePreview({
  row,
  locales,
  moduleSlug,
  appSlug,
}: BundlePreviewProps) {
  const { t } = useTranslation('translations');
  const [activeCode, setActiveCode] = useState(
    locales[0]?.locale.code ?? '',
  );

  const cell = readCell(row, activeCode);
  const isLive = cell.status === 'published';

  const body = isLive
    ? JSON.stringify({ [moduleSlug ?? 'module']: { [row.key]: cell.value } }, null, 2)
    : '{}';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-paragraph-xs text-sub-dark">
          {t('whatTheAppReceives')}
        </span>
        <div className="flex flex-wrap gap-1">
          {locales.map((locale) => (
            <LocaleTab
              key={locale.localeId}
              code={locale.locale.code}
              isActive={locale.locale.code === activeCode}
              onSelect={setActiveCode}
            />
          ))}
        </div>
      </div>

      {/* Block `dir="ltr"`: JSON is left-aligned in every locale and its
          indentation must not mirror (RTL Rule 4). */}
      <div
        dir="ltr"
        className="flex flex-col gap-1.5 rounded-8 border border-soft-light bg-weak p-2.5"
      >
        <LtrText mono className="text-paragraph-xs text-primary-base">
          GET /v1/apps/{appSlug ?? ':app'}/locales/{activeCode}
        </LtrText>
        <pre className="whitespace-pre-wrap font-mono text-paragraph-xs text-strong">
          {body}
        </pre>
      </div>
    </div>
  );
}

type LocaleTabProps = {
  code: string;
  isActive: boolean;
  onSelect: (code: string) => void;
};

function LocaleTab({ code, isActive, onSelect }: LocaleTabProps) {
  function handleClick() {
    onSelect(code);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'cursor-pointer rounded-4 border px-1.5 py-0.5 font-mono text-paragraph-xs transition-colors',
        isActive
          ? 'border-primary-base text-primary-base'
          : 'border-soft-light text-sub-dark hover:bg-weak',
      )}
    >
      {code}
    </button>
  );
}
