import { cva } from 'class-variance-authority';

/**
 * Ported from `@yamm/core`. Every (variant × color) pair is a compound variant
 * so exactly one `bg-*`, `border-*` and `text-*` utility lands on the element.
 *
 * Gray is the exception to the semantic tokens: the design pins it to the raw
 * Neutral scale, identical in both modes, so it uses the mode-invariant
 * `faded-*` tokens. Routing it through `sub-dark`/`soft-light` would flip it in
 * dark mode and put white text on a light pill.
 */
export const badgeVariants = cva(
  'flex items-center justify-center gap-0.5 rounded-full py-0.5',
  {
    variants: {
      variant: {
        filled: 'text-statics-white',
        light: '',
        lighter: '',
        outline: 'border bg-transparent',
      },
      state: { default: '', disabled: '' },
      size: {
        sm: 'min-h-4 text-subheading-2xs uppercase',
        md: 'min-h-5 text-label-xs',
      },
      color: {
        gray: '',
        blue: '',
        yellow: '',
        red: '',
        green: '',
        orange: '',
        purple: '',
      },
      /** Count badge: a circular pill sized from its `min-h`. */
      numeric: { true: 'px-0.5', false: 'px-2' },
    },
    compoundVariants: [
      // Match `min-w` to `min-h` so a single-digit count renders as a circle.
      { numeric: true, size: 'sm', className: 'min-w-4' },
      { numeric: true, size: 'md', className: 'min-w-5' },
      // The border is drawn inside the 16px box, so give the 1px back out of
      // the vertical padding — otherwise `sm` grows to 18px.
      { size: 'sm', variant: 'outline', className: 'py-px' },

      { variant: 'filled', color: 'gray', className: 'bg-faded-medium' },
      { variant: 'filled', color: 'blue', className: 'bg-information-base' },
      { variant: 'filled', color: 'yellow', className: 'bg-warning-base' },
      { variant: 'filled', color: 'red', className: 'bg-error-base' },
      { variant: 'filled', color: 'green', className: 'bg-success-base' },
      { variant: 'filled', color: 'orange', className: 'bg-away-base' },
      { variant: 'filled', color: 'purple', className: 'bg-primary-base' },

      {
        variant: 'light',
        color: 'gray',
        className: 'bg-faded-light text-faded-strong',
      },
      {
        variant: 'light',
        color: 'blue',
        className: 'bg-information-light text-information-dark',
      },
      {
        variant: 'light',
        color: 'yellow',
        className: 'bg-warning-light text-warning-dark',
      },
      {
        variant: 'light',
        color: 'red',
        className: 'bg-error-light text-error-dark',
      },
      {
        variant: 'light',
        color: 'green',
        className: 'bg-success-light text-success-dark',
      },
      {
        variant: 'light',
        color: 'orange',
        className: 'bg-away-light text-away-dark',
      },
      {
        variant: 'light',
        color: 'purple',
        className: 'bg-primary-light text-primary-dark',
      },

      {
        variant: 'lighter',
        color: 'gray',
        className: 'bg-faded-lighter text-faded-medium',
      },
      {
        variant: 'lighter',
        color: 'blue',
        className: 'bg-information-lighter text-information-base',
      },
      {
        variant: 'lighter',
        color: 'yellow',
        className: 'bg-warning-lighter text-warning-base',
      },
      {
        variant: 'lighter',
        color: 'red',
        className: 'bg-error-lighter text-error-on-lighter',
      },
      {
        variant: 'lighter',
        color: 'green',
        className: 'bg-success-lighter text-success-base',
      },
      {
        variant: 'lighter',
        color: 'orange',
        className: 'bg-away-lighter text-away-base',
      },
      {
        variant: 'lighter',
        color: 'purple',
        className: 'bg-primary-lighter text-primary-base',
      },

      {
        variant: 'outline',
        color: 'gray',
        className: 'border-faded-soft text-faded-soft',
      },
      {
        variant: 'outline',
        color: 'blue',
        className: 'border-information-base text-information-base',
      },
      {
        variant: 'outline',
        color: 'yellow',
        className: 'border-warning-base text-warning-base',
      },
      {
        variant: 'outline',
        color: 'red',
        className: 'border-error-base text-error-base',
      },
      {
        variant: 'outline',
        color: 'green',
        className: 'border-success-base text-success-base',
      },
      {
        variant: 'outline',
        color: 'orange',
        className: 'border-away-base text-away-base',
      },
      {
        variant: 'outline',
        color: 'purple',
        className: 'border-primary-base text-primary-base',
      },

      // Last entry, so it overrides whichever colour pair matched above.
      {
        state: 'disabled',
        className: 'border border-soft-light bg-transparent text-sub-light',
      },
    ],
    defaultVariants: {
      variant: 'filled',
      size: 'sm',
      color: 'gray',
      numeric: false,
    },
  },
);
