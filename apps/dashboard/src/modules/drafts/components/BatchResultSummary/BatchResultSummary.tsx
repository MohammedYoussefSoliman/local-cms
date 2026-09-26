import { Alert, Button } from '@cms/ui';
import { useTranslation } from 'react-i18next';


import type { BatchResultSummaryProps } from './BatchResultSummary.types';

/**
 * What a partial batch leaves behind. "Select the failed ones" reduces the
 * selection to exactly the failures, so a retry re-attempts those and nothing
 * else — otherwise the user re-publishes rows that already went live.
 */
export function BatchResultSummary({
  result,
  onSelectFailed,
  onDismiss,
}: BatchResultSummaryProps) {
  const { t } = useTranslation('drafts');

  const total = result.succeeded.length + result.failed.length;

  return (
    <Alert
      status="warning"
      title={t('partialTitle', {
        succeeded: result.succeeded.length,
        total,
      })}
      onClose={onDismiss}
      closeLabel={t('dismiss')}
      actions={
        <Button
          type="button"
          size="xs"
          variant="outline"
          color="neutral"
          onClick={onSelectFailed}
        >
          {t('selectFailedOnly')}
        </Button>
      }
    />
  );
}
