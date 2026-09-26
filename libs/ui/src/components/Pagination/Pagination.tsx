import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';
import { useMemo } from 'react';


import { cn } from '../../functions';

import { getPageRange } from './functions';

import type { PaginationProps } from './Pagination.types';


const BUTTON_CLASSES =
  'flex size-8 min-w-8 cursor-pointer items-center justify-center border border-soft-light bg-white text-paragraph-sm text-sub-dark transition-colors hover:bg-weak hover:text-strong disabled:cursor-not-allowed disabled:bg-white disabled:text-sub-light';

/**
 * Chevrons point along the reading direction, so every one of them carries
 * `rtl:-scale-x-100` — "next" must point left in Arabic
 * (`.claude/rules/global-rtl-direction.md` Rule 3).
 */
export function Pagination({
  currentPage,
  lastPage,
  onPageChange,
  className,
}: PaginationProps) {
  const pages = useMemo(
    () => getPageRange(currentPage, lastPage),
    [currentPage, lastPage],
  );

  function handleFirst() {
    onPageChange(1);
  }
  function handlePrevious() {
    onPageChange(currentPage - 1);
  }
  function handleNext() {
    onPageChange(currentPage + 1);
  }
  function handleLast() {
    onPageChange(lastPage);
  }

  const atStart = currentPage <= 1;
  const atEnd = currentPage >= lastPage;

  return (
    <nav
      aria-label="pagination"
      className={cn('flex w-fit items-center', className)}
    >
      <button
        type="button"
        onClick={handleFirst}
        disabled={atStart}
        aria-label="Go to first page"
        className={cn(BUTTON_CLASSES, 'rounded-s-8')}
      >
        <ChevronsLeft size={16} className="rtl:-scale-x-100" />
      </button>
      <button
        type="button"
        onClick={handlePrevious}
        disabled={atStart}
        aria-label="Go to previous page"
        className={BUTTON_CLASSES}
      >
        <ChevronLeft size={16} className="rtl:-scale-x-100" />
      </button>

      {pages.map((page, index) =>
        page === 'ellipsis' ? (
          <span
            key={`ellipsis-${index}`}
            className={cn(BUTTON_CLASSES, 'cursor-default')}
          >
            <MoreHorizontal size={16} />
          </span>
        ) : (
          <PageButton
            key={page}
            page={page}
            isActive={page === currentPage}
            onPageChange={onPageChange}
          />
        ),
      )}

      <button
        type="button"
        onClick={handleNext}
        disabled={atEnd}
        aria-label="Go to next page"
        className={BUTTON_CLASSES}
      >
        <ChevronRight size={16} className="rtl:-scale-x-100" />
      </button>
      <button
        type="button"
        onClick={handleLast}
        disabled={atEnd}
        aria-label="Go to last page"
        className={cn(BUTTON_CLASSES, 'rounded-e-8')}
      >
        <ChevronsRight size={16} className="rtl:-scale-x-100" />
      </button>
    </nav>
  );
}

type PageButtonProps = {
  page: number;
  isActive: boolean;
  onPageChange: (page: number) => void;
};

/**
 * Its own component so the click handler closes over `page` without an inline
 * arrow in JSX (`.claude/rules/global-react-components.md`, Event Handling).
 */
function PageButton({ page, isActive, onPageChange }: PageButtonProps) {
  function handleClick() {
    onPageChange(page);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        BUTTON_CLASSES,
        isActive && 'bg-primary-lighter text-primary-base',
      )}
    >
      {page}
    </button>
  );
}
