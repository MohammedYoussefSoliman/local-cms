
import { Alert, LtrText, Textarea } from '@cms/ui';
import { useTranslation } from 'react-i18next';

import { TranslationStatusBadge } from '@/components';

import type { LocaleEditorProps } from './LocaleEditor.types';
import type { ChangeEvent } from 'react';

/**
 * One language's box for one key.
 *
 * `dir` comes from `locale.locale.direction` — the locale row's own direction,
 * read from the database. Never from `i18n.dir()`, and never inferred from the
 * code with an `['ar','he','fa']` list, which is the compile-time language
 * union of invariant Rule 1 wearing a different hat. An Arabic UI editing
 * French must type LTR.
 */
export function LocaleEditor({
  locale,
  cell,
  draft,
  onChange,
  disabled,
}: LocaleEditorProps) {
  const { t } = useTranslation('translations');

  const isDirty = draft !== undefined;
  const value = draft ?? cell.value;
  const direction = locale.locale.direction;

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(cell.entryId, locale.locale.code, event.target.value);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-paragraph-xs text-sub-dark">
          <LtrText mono className="text-paragraph-xs text-strong">
            {locale.locale.code}
          </LtrText>
          <span dir={direction}>{locale.locale.nativeName}</span>
          {locale.isDefault && (
            <span className="text-paragraph-xs text-sub-dark">
              · {t('filterAll')}
            </span>
          )}
        </span>
        <TranslationStatusBadge status={isDirty ? 'unsaved' : cell.status} />
      </div>

      {/* Present BEFORE the first keystroke, not after the save. An editor who
          only learns the value was live from a toast has already shipped it. */}
      {cell.status === 'published' && (
        <Alert status="warning" title={t('livePublishedTitle')} className="py-2">
          {t('livePublishedBody')}
        </Alert>
      )}

      <Textarea
        dir={direction}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={t('notTranslated')}
        className="min-h-16"
      />
    </div>
  );
}
