import { cva } from 'class-variance-authority';

/**
 * `bg-white` is explicit rather than inherited: a field dropped on a tinted
 * surface (a `bg-weak` panel, a grey option row) otherwise shows that surface
 * through its own box and stops reading as a field. `--color-white` is a theme
 * token, so this still flips in dark mode.
 */
export const inputVariants = cva(
  'relative flex items-center gap-2 rounded-8 border border-soft-light bg-white px-2.5 shadow-regular-xs transition-colors hover:bg-weak focus-within:border-strong focus-within:ring-2 focus-within:ring-faded-light group-data-[state=disabled]:bg-weak group-data-[state=error]:border-error-base group-data-[state=error]:focus-within:ring-error-lighter',
  {
    variants: {
      size: {
        md: 'h-10',
        sm: 'h-9',
        xs: 'h-8',
      },
    },
    defaultVariants: { size: 'md' },
  },
);
