import { Button, Checkbox, LtrText } from '@cms/ui';
import { useTranslation } from 'react-i18next';


import { RelativeTime, TranslationStatusBadge, ValueText } from '@/components';

import { DraftConflictDisclosure } from '../DraftConflictDisclosure';

import type { DraftRowProps } from './DraftRow.types';

const FAILURE_MESSAGE_KEY = {
  conflict: 'failureConflict',
  forbidden: 'failureForbidden',
  transition: 'failureTransition',
  missing: 'failureMissing',
  unknown: 'failureUnknown',
} as const;

/**
 * One queue row.
 *
 * Its own component so every handler closes over `row` without an inline arrow
 * in the table's JSX, and so the conflict disclosure has somewhere to live
 * under the row it belongs to.
 *
 * Per-row publish does not confirm: one row, fully visible, and reversible
 * through archive or rollback. The confirm is reserved for the batch actions.
 */
export function DraftRow({
  row,
  isSelected,
  isPublishing,
  failure,
  onToggle,
  onPublish,
  onPublishVersion,
  onOpenInEditor,
}: DraftRowProps) {
  const { t } = useTranslation('drafts');

  function handleToggle() {
    onToggle(row.id);
  }

  function handlePublish() {
    onPublish(row);
  }

  function handlePublishVersion(expectedVersion: number) {
    onPublishVersion(row, expectedVersion);
  }

  function handleOpenInEditor() {
    onOpenInEditor(row);
  }

  return (
    <>
      <tr className="border-b border-soft-light hover:bg-weak">
        <td className="w-px p-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleToggle}
            aria-label={t('selectRow', { key: row.key })}
          />
        </td>

        <td className="w-44 p-3">
          <div className="flex flex-col gap-0.5">
            <LtrText mono className="text-paragraph-sm text-strong">
              {row.key}
            </LtrText>
            <span className="text-paragraph-xs text-sub-dark">
              {row.moduleName}
            </span>
          </div>
        </td>

        <td className="w-px whitespace-nowrap p-3">
          <div className="flex items-center gap-1.5">
            {/* A BCP 47 tag is a technical string in every locale. */}
            <LtrText mono className="text-paragraph-sm text-strong">
              {row.localeCode}
            </LtrText>
            {row.status === 'in_review' && (
              <TranslationStatusBadge status="in_review" />
            )}
          </div>
        </td>

        <td className="p-3">
          <ValueText value={row.value} direction={row.localeDirection} truncate />
        </td>

        <td className="w-36 whitespace-nowrap p-3">
          <div className="flex flex-col gap-0.5">
            <LtrText className="text-paragraph-xs text-strong">
              {row.updatedByName ?? t('unknownAuthor')}
            </LtrText>
            <RelativeTime value={row.updatedAt} />
          </div>
        </td>

        <td className="w-px whitespace-nowrap p-3 text-end">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={handlePublish}
            loading={isPublishing}
          >
            {t('publish')}
          </Button>
        </td>
      </tr>

      {!!failure && (
        <tr>
          <td colSpan={6} className="px-3 pb-3">
            {failure.kind === 'conflict' && failure.conflict ? (
              <DraftConflictDisclosure
                conflict={failure.conflict}
                shownValue={row.value}
                direction={row.localeDirection}
                onPublishCurrent={handlePublishVersion}
                onOpenInEditor={handleOpenInEditor}
                isPublishing={isPublishing}
              />
            ) : (
              <p className="rounded-8 bg-error-lighter p-2.5 text-paragraph-xs text-error-on-lighter">
                {t(FAILURE_MESSAGE_KEY[failure.kind])}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
