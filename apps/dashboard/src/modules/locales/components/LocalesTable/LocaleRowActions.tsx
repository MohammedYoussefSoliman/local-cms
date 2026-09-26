import { Button } from '@cms/ui';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';


import type { LocaleRow } from './LocalesTable.types';

type LocaleRowActionsProps = {
  row: LocaleRow;
  canManage: boolean;
  isToggling: boolean;
  onToggle: (row: LocaleRow) => void;
};

/**
 * Its own component so the handler closes over the row without an inline arrow
 * in the table's JSX.
 */
export function LocaleRowActions({
  row,
  canManage,
  isToggling,
  onToggle,
}: LocaleRowActionsProps) {
  const { t } = useTranslation('locales');

  function handleToggle() {
    onToggle(row);
  }

  // The app's default language has nowhere to fall back to if it is switched
  // off, so the API refuses it with a 422 — say so instead of offering a button
  // that cannot work.
  if (row.appLocale?.isDefault) {
    return (
      <span className="inline-flex items-center gap-1.5 text-paragraph-xs text-sub-dark">
        <Lock size={13} />
        {t('defaultLocked')}
      </span>
    );
  }

  if (!canManage) return null;

  const isEnabled = Boolean(row.appLocale?.isEnabled);

  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      color={isEnabled ? 'neutral' : 'primary'}
      loading={isToggling}
      onClick={handleToggle}
    >
      {isEnabled ? t('disable') : t('enable')}
    </Button>
  );
}
