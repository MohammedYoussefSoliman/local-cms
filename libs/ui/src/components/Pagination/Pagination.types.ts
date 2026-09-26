export type PaginationProps = {
  currentPage: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}
