import { Button, Modal } from '@cms/ui';
import { useTranslation } from 'react-i18next';


import type { ConfirmDialogProps } from './ConfirmDialog.types';

/**
 * The one confirm shape in the dashboard. Reserved for actions that are hard to
 * take back or that touch many rows at once — a confirm on every ordinary save
 * gets dismissed without reading within a week, which is worse than none.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  confirmColor = 'primary',
  isPending,
  onConfirm,
  type = 'warning',
}: ConfirmDialogProps) {
  const { t } = useTranslation('app');

  function handleCancel() {
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      headerSubtitle={description}
      type={type}
      closeLabel={t('close')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            color="neutral"
            size="small"
            onClick={handleCancel}
          >
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button
            type="button"
            color={confirmColor}
            size="small"
            loading={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
