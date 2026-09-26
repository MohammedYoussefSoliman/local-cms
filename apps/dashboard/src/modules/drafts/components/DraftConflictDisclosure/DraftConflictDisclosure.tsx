import { Button } from '@cms/ui';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TranslationStatusBadge, ValueText } from '@/components';

import type { DraftConflictDisclosureProps } from './DraftConflictDisclosure.types';

/**
 * Invariant Rule 7, in the batch path.
 *
 * Rule 7 requires showing the editor *what landed*, not just that they lost —
 * but N modals for N conflicts is unusable, so the batch case renders the
 * landed value inline instead. It never auto-retries with the new version:
 * that would silently publish text the editor has not read, which is the one
 * outcome the rule names as unacceptable.
 */
export function DraftConflictDisclosure({
  conflict,
  shownValue,
  direction,
  onPublishCurrent,
  onOpenInEditor,
  isPublishing,
}: DraftConflictDisclosureProps) {
  const { t } = useTranslation('drafts');
  const [isOpen, setIsOpen] = useState(false);

  function handleToggle() {
    setIsOpen((open) => !open);
  }

  function handlePublishCurrent() {
    onPublishCurrent(conflict.currentVersion);
  }

  return (
    <div className="flex flex-col gap-2 rounded-8 bg-warning-lighter p-2.5">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="flex cursor-pointer items-center gap-1.5 text-start text-paragraph-xs text-strong"
      >
        {/* Directional: a disclosure chevron points along the reading flow. */}
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform rtl:-scale-x-100 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
        {t('failureConflict')}
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 ps-5">
          <div className="flex flex-col gap-1">
            <span className="text-paragraph-xs text-sub-dark">
              {t('conflictShown')}
            </span>
            <ValueText value={shownValue} direction={direction} />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-paragraph-xs text-sub-dark">
                {t('conflictCurrent')}
              </span>
              <TranslationStatusBadge status={conflict.currentStatus} />
              <span className="text-paragraph-xs text-sub-dark">
                {t('conflictVersion', { version: conflict.currentVersion })}
              </span>
            </div>
            <ValueText value={conflict.currentValue} direction={direction} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="xs"
              onClick={handlePublishCurrent}
              loading={isPublishing}
            >
              {t('publishCurrent')}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              color="neutral"
              onClick={onOpenInEditor}
            >
              {t('openInEditor')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
