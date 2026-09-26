import {
  Alert,
  Button,
  ControlledSelect,
  ControlledTextInput,
  Form,
  LtrText,
  Modal,
  showToast,
} from '@cms/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useInviteUser } from '../../services';
import {
  type InviteUserSchemaValues,
  useInviteUserSchema,
} from '../../validations';

const DEFAULT_VALUES: InviteUserSchemaValues = {
  name: '',
  email: '',
  role: 'editor',
};

export type InviteUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Two steps in one dialog: the form, then the link.
 *
 * The second step is not optional polish. The plaintext token exists only in
 * the response that mints it — closing the dialog without copying it means
 * re-issuing the invitation, which revokes the one already sent.
 */
export function InviteUserDialog({
  open,
  onOpenChange,
}: InviteUserDialogProps) {
  const { t } = useTranslation(['users', 'app']);
  const schema = useInviteUserSchema();
  const inviteUser = useInviteUser();

  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);

  function handleClose() {
    setAcceptUrl(null);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setAcceptUrl(null);
    onOpenChange(next);
  }

  async function handleSubmit(values: InviteUserSchemaValues) {
    const created = await inviteUser.mutateAsync(values);
    setAcceptUrl(created.invitation.acceptUrl);
  }

  async function handleCopy() {
    if (!acceptUrl) return;
    try {
      await navigator.clipboard.writeText(acceptUrl);
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('users:linkCopied'),
      });
    } catch {
      // Clipboard access can be refused; the link is on screen to copy by hand.
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={t('users:inviteTitle')}
      headerSubtitle={t('users:inviteSubtitle')}
      closeLabel={t('app:close')}
    >
      {acceptUrl ? (
        <div className="flex flex-col gap-4">
          <Alert status="warning" title={t('users:linkTitle')}>
            {t('users:linkDescription')}
          </Alert>

          {/* A URL is a technical string; block `dir` so it does not mirror. */}
          <div
            dir="ltr"
            className="rounded-8 border border-soft-light bg-weak p-2.5"
          >
            <LtrText mono className="break-all text-paragraph-xs text-strong">
              {acceptUrl}
            </LtrText>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              color="neutral"
              size="small"
              onClick={handleClose}
            >
              {t('users:done')}
            </Button>
            <Button type="button" size="small" onClick={handleCopy}>
              <Copy size={16} />
              {t('users:copyLink')}
            </Button>
          </div>
        </div>
      ) : (
        <Form<InviteUserSchemaValues>
          resolver={zodResolver(schema)}
          defaultValues={DEFAULT_VALUES}
          onSubmit={handleSubmit}
        >
          <ControlledTextInput<InviteUserSchemaValues>
            name="name"
            label={t('users:inviteName')}
            required
          />
          <ControlledTextInput<InviteUserSchemaValues>
            name="email"
            type="email"
            label={t('users:inviteEmail')}
            required
            dir="ltr"
            inputClassName="text-start"
          />
          <ControlledSelect<InviteUserSchemaValues>
            name="role"
            label={t('users:inviteRole')}
            options={[
              { value: 'editor', label: t('app:roleEditor') },
              { value: 'admin', label: t('app:roleAdmin') },
            ]}
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              color="neutral"
              size="small"
              onClick={handleClose}
            >
              {t('app:cancel')}
            </Button>
            <Button type="submit" size="small" loading={inviteUser.isPending}>
              {t('users:inviteCta')}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
