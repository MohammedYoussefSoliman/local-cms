import {
  Button,
  Card,
  ControlledTextInput,
  EmptyState,
  Form,
  LtrText,
  Skeleton,
} from '@cms/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router-dom';


import { URLS } from '@/helpers';
import { AuthLayout } from '@/layouts';

import { useAcceptInvitation, useGetInvitationPreview } from '../services';
import {
  type AcceptInvitationSchemaValues,
  useAcceptInvitationSchema,
} from '../validations';

const DEFAULT_VALUES: AcceptInvitationSchemaValues = {
  password: '',
  confirmPassword: '',
};

/**
 * The only way a second person gets into the CMS.
 *
 * The token arrives as `?token=` on the link the invitee was sent and is moved
 * straight into `X-Invite-Token` — it is never put back into a URL the browser
 * will remember.
 */
export function AcceptInvitationPage() {
  const { t } = useTranslation(['auth', 'app']);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const schema = useAcceptInvitationSchema();
  const { data, isLoading, isInvalid } = useGetInvitationPreview(token);
  const accept = useAcceptInvitation(token);

  if (accept.isSuccess) return <Navigate to={URLS.apps} replace />;

  function handleSubmit(values: AcceptInvitationSchemaValues) {
    accept.mutate({ password: values.password });
  }

  if (!token || isInvalid) {
    return (
      <AuthLayout>
        <Card>
          <EmptyState
            icon={<MailX size={28} />}
            title={t('auth:invitationInvalidTitle')}
            description={t('auth:invitationInvalidDescription')}
            action={
              <Link to={URLS.login}>
                <Button variant="outline" color="neutral" size="small">
                  {t('auth:backToSignIn')}
                </Button>
              </Link>
            }
          />
        </Card>
      </AuthLayout>
    );
  }

  if (isLoading) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-40 rounded-4" />
          <Skeleton className="h-3.5 w-64 rounded-4" />
        </div>
        <Card>
          <Skeleton className="h-3.5 w-24 rounded-4" />
          <Skeleton className="h-10 w-full rounded-8" />
          <Skeleton className="h-3.5 w-28 rounded-4" />
          <Skeleton className="h-10 w-full rounded-8" />
          <Skeleton className="h-10 w-full rounded-8" />
        </Card>
      </AuthLayout>
    );
  }

  const roleLabel =
    data?.role === 'admin' ? t('app:roleAdmin') : t('app:roleEditor');

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-xl text-strong">{t('auth:acceptTitle')}</h1>
        <p className="text-paragraph-sm text-sub-dark">
          {t('auth:acceptSubtitle', { role: roleLabel })}
        </p>
        <LtrText className="text-paragraph-sm text-strong">
          {data?.email}
        </LtrText>
      </div>

      <Card>
        <Form<AcceptInvitationSchemaValues>
          resolver={zodResolver(schema)}
          defaultValues={DEFAULT_VALUES}
          onSubmit={handleSubmit}
        >
          <ControlledTextInput<AcceptInvitationSchemaValues>
            name="password"
            type="password"
            autoComplete="new-password"
            label={t('auth:newPassword')}
            required
            dir="ltr"
            inputClassName="text-start"
          />
          <ControlledTextInput<AcceptInvitationSchemaValues>
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            label={t('auth:confirmPassword')}
            required
            dir="ltr"
            inputClassName="text-start"
          />
          <Button type="submit" loading={accept.isPending} className="w-full">
            {t('auth:acceptCta')}
          </Button>
        </Form>
      </Card>
    </AuthLayout>
  );
}
