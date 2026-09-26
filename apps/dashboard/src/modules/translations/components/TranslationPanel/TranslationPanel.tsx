import { Button, Drawer, LtrText } from '@cms/ui';
import { Trash2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cellKey, readCell } from '../../functions';
import { LocaleEditor } from '../LocaleEditor';

import { BundlePreview } from './BundlePreview';

import type { TranslationPanelProps } from './TranslationPanel.types';


/**
 * The editing surface for one key, across every language the app serves.
 *
 * The primary button's LABEL is derived from what the write will actually do:
 * a value that is already published goes live on save, so it never says
 * "draft". There is no button here labelled "draft" that publishes, and none
 * labelled "save" that goes live.
 */
export function TranslationPanel({
  row,
  locales,
  moduleSlug,
  appSlug,
  drafts,
  isSaving,
  canDelete,
  onChange,
  onSave,
  onDiscard,
  onDelete,
  onClose,
}: TranslationPanelProps) {
  const { t } = useTranslation('translations');

  function handleOpenChange(open: boolean) {
    if (!open) onClose();
  }

  // The page only mounts this when a row is selected; the guard keeps the
  // prop optional for callers that pass a lookup result straight through.
  if (!row) return null;

  const selectedRow = row;

  const isDirty = locales.some(
    (locale) =>
      drafts[cellKey(selectedRow.entryId, locale.locale.code)] !== undefined,
  );

  // Any language of this key already live? Then saving republishes it, and the
  // label has to say so.
  const touchesPublished = locales.some((locale) => {
    const key = cellKey(selectedRow.entryId, locale.locale.code);
    if (drafts[key] === undefined) return false;
    return readCell(selectedRow, locale.locale.code).status === 'published';
  });

  function handleSave() {
    onSave(selectedRow.entryId);
  }

  function handleDiscard() {
    onDiscard(selectedRow.entryId);
  }

  function handleDelete() {
    onDelete(selectedRow);
  }

  return (
    <Drawer
      open
      onOpenChange={handleOpenChange}
      closeLabel={t('discard')}
      title={
        <LtrText mono className="break-all text-label-md">
          {selectedRow.key}
        </LtrText>
      }
      subtitle={selectedRow.description ?? undefined}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="small"
            disabled={!isDirty}
            loading={isSaving}
            onClick={handleSave}
          >
            {touchesPublished ? <Zap size={16} /> : null}
            {touchesPublished ? t('saveAndPublish') : t('saveDraft')}
          </Button>
          <Button
            type="button"
            size="small"
            variant="ghost"
            color="neutral"
            disabled={!isDirty}
            onClick={handleDiscard}
          >
            {t('discard')}
          </Button>

          {canDelete && (
            <Button
              type="button"
              size="small"
              variant="ghost"
              color="error"
              className="ms-auto"
              onClick={handleDelete}
            >
              <Trash2 size={16} />
              {t('deleteKey')}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {locales.map((locale) => (
          <LocaleEditor
            key={locale.localeId}
            locale={locale}
            cell={readCell(selectedRow, locale.locale.code)}
            draft={drafts[cellKey(selectedRow.entryId, locale.locale.code)]}
            onChange={onChange}
            disabled={isSaving}
          />
        ))}

        <BundlePreview
          row={selectedRow}
          locales={locales}
          moduleSlug={moduleSlug}
          appSlug={appSlug}
        />
      </div>
    </Drawer>
  );
}
