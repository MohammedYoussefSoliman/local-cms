import { cn } from '@cms/ui';
import { useTranslation } from 'react-i18next';


import { formatRelative } from './functions';

import type { RelativeTimeProps } from './RelativeTime.types';


/**
 * "2 hours ago", localized.
 *
 * `Intl` handles the Arabic forms and the Arabic-Indic digits, so there is no
 * `dir` isolation here: the output is already in the UI's language and
 * isolating it would fight its own direction. The absolute timestamp goes in
 * `title` for anyone who needs the real value.
 */
export function RelativeTime({ value, className }: RelativeTimeProps) {
  const { i18n } = useTranslation('app');
  const date = new Date(value);

  return (
    <time
      dateTime={value}
      title={new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)}
      className={cn('text-paragraph-xs text-sub-dark', className)}
    >
      {formatRelative(date, i18n.language)}
    </time>
  );
}
