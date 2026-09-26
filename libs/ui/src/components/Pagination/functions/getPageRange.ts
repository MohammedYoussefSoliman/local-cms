/**
 * Builds the visible page list, collapsing runs with an ellipsis so the pager
 * stays a fixed width no matter how many pages there are.
 */
export function getPageRange(
  currentPage: number,
  lastPage: number,
): (number | 'ellipsis')[] {
  const MAX_VISIBLE = 5;

  if (lastPage <= MAX_VISIBLE) {
    return Array.from({ length: Math.max(lastPage, 1) }, (_, i) => i + 1);
  }

  if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis', lastPage];

  if (currentPage >= lastPage - 2) {
    return [1, 'ellipsis', lastPage - 3, lastPage - 2, lastPage - 1, lastPage];
  }

  return [
    1,
    'ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis',
    lastPage,
  ];
}
