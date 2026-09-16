import { toast } from 'sonner';

export type ShowToastArgs = {
  status: 'success' | 'error' | 'warning' | 'info';
  variant?: 'filled' | 'outline';
  title: string;
  description?: string;
};

/**
 * Object form only. A positional signature is impossible to read at a call
 * site and was the source of silently swapped title/description arguments in
 * the frontend monorepo.
 */
export function showToast({ status, title, description }: ShowToastArgs): void {
  toast[status](title, description ? { description } : undefined);
}
