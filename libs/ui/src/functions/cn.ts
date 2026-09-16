import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind classes so a caller's `className` reliably wins over the
 * component's defaults. Every component merges through this — never template
 * strings, which produce two conflicting utilities and let source order decide.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
