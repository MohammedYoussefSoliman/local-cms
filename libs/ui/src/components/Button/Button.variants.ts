import { cva } from 'class-variance-authority';

/**
 * Ported from the frontend monorepo's `@yamm/core` Button.
 *
 * Every (color × variant) pair is a compound variant so exactly one `bg-*`,
 * `border-*` and `text-*` utility ever lands on the element. cva only
 * concatenates classes — two competing `bg-*` utilities would be resolved by
 * their order in the compiled stylesheet rather than by intent, which is what
 * makes `!important` feel necessary elsewhere.
 */
export const buttonVariants = cva(
  'relative z-10 flex cursor-pointer items-center justify-center gap-2 transition-all duration-200 ease-in-out',
  {
    variants: {
      color: {
        primary: 'text-primary-base focus:ring-2 focus:ring-primary-base/10',
        neutral: 'text-strong focus:ring-2 focus:ring-strong/15',
        error: 'text-error-base focus:ring-2 focus:ring-error-lighter',
        success: 'text-success-base focus:ring-2 focus:ring-success-lighter',
      },
      variant: {
        filled: 'border-0',
        outline: 'border bg-white',
        lighter: 'border border-transparent',
        ghost: 'border border-transparent bg-transparent',
      },
      state: {
        default: '',
        disabled: 'cursor-not-allowed border-0 bg-weak text-sub-light',
      },
      size: {
        medium: 'h-10 min-w-max rounded-8 px-3',
        small: 'h-9 min-w-max rounded-8 px-2.5',
        xs: 'h-8 min-w-max rounded-8 px-2',
        '2xs': 'h-7 min-w-max rounded-8 px-1.5',
        'icon-md': 'size-10 rounded-8 p-2.5',
        'icon-sm': 'size-9 rounded-8 p-2',
        'icon-xs': 'size-8 rounded-8 p-1.5',
        'icon-2xs': 'size-7 rounded-8 p-1',
      },
    },
    compoundVariants: [
      {
        color: 'primary',
        variant: 'filled',
        className:
          'bg-primary-base text-statics-white hover:bg-purple-700 focus:bg-primary-base',
      },
      {
        color: 'primary',
        variant: 'outline',
        className:
          'border-primary-base hover:border-transparent hover:bg-primary-lighter',
      },
      {
        color: 'primary',
        variant: 'lighter',
        className:
          'bg-primary-lighter hover:border-primary-base hover:bg-white focus:bg-white',
      },
      {
        color: 'primary',
        variant: 'ghost',
        className: 'hover:bg-primary-lighter focus:border-primary-base',
      },

      {
        color: 'neutral',
        variant: 'filled',
        className: 'bg-strong text-white hover:bg-surface focus:bg-strong',
      },
      {
        color: 'neutral',
        variant: 'outline',
        className:
          'border-soft-light hover:border-transparent hover:bg-weak focus:border-strong',
      },
      {
        color: 'neutral',
        variant: 'lighter',
        className: 'bg-weak hover:border-soft-light hover:bg-white',
      },
      {
        color: 'neutral',
        variant: 'ghost',
        className: 'hover:bg-weak focus:border-strong',
      },

      {
        color: 'error',
        variant: 'filled',
        className:
          'bg-error-base text-statics-white hover:bg-red-700 focus:bg-error-base',
      },
      {
        color: 'error',
        variant: 'outline',
        className:
          'border-error-base hover:border-transparent hover:bg-error-lighter',
      },
      {
        color: 'error',
        variant: 'lighter',
        className:
          'bg-error-lighter hover:border-error-base hover:bg-white focus:bg-white',
      },
      {
        color: 'error',
        variant: 'ghost',
        className: 'hover:bg-error-lighter focus:border-error-base',
      },

      {
        color: 'success',
        variant: 'filled',
        className:
          'bg-success-base text-statics-white hover:bg-green-700 focus:bg-success-base',
      },
      {
        color: 'success',
        variant: 'outline',
        className:
          'border-success-base hover:border-transparent hover:bg-success-lighter',
      },
      {
        color: 'success',
        variant: 'lighter',
        className:
          'bg-success-lighter hover:border-success-base hover:bg-white focus:bg-white',
      },
      {
        color: 'success',
        variant: 'ghost',
        className: 'hover:bg-success-lighter focus:border-success-base',
      },

      // Last, so it overrides whichever colour pair matched above.
      {
        state: 'disabled',
        className: 'bg-weak text-sub-light hover:bg-weak',
      },
    ],
    defaultVariants: {
      color: 'primary',
      variant: 'filled',
      state: 'default',
      size: 'medium',
    },
  },
);
