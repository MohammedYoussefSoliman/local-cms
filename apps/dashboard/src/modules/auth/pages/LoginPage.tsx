import { Button, Card, ControlledTextInput, Form } from '@cms/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';


import { URLS } from '@/helpers';
import { AuthLayout } from '@/layouts';
import { useAuthStore } from '@/store';

import { useLogin } from '../services';
import {
  type LoginFormSchemaValues,
  useLoginFormSchema,
} from '../validations';

const DEFAULT_VALUES: LoginFormSchemaValues = { email: '', password: '' };

export function LoginPage() {
  const { t } = useTranslation(['auth', 'app']);
  const schema = useLoginFormSchema();
  const login = useLogin();
  const location = useLocation();

  const refreshToken = useAuthStore((state) => state.refreshToken);

  // Derived during render, not synced in an effect: someone who already has a
  // session and lands on /login belongs back where they came from.
  if (refreshToken) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? URLS.apps} replace />;
  }

  function handleSubmit(values: LoginFormSchemaValues) {
    login.mutate(values);
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-xl text-strong">{t('auth:signInTitle')}</h1>
        <p className="text-paragraph-sm text-sub-dark">
          {t('auth:signInSubtitle')}
        </p>
      </div>

      <Card>
        <Form<LoginFormSchemaValues>
          resolver={zodResolver(schema)}
          defaultValues={DEFAULT_VALUES}
          onSubmit={handleSubmit}
        >
          <ControlledTextInput<LoginFormSchemaValues>
            name="email"
            type="email"
            autoComplete="email"
            label={t('app:email')}
            required
            // An address is a technical string: it reads left-to-right in every
            // locale, so the field's own content direction is pinned even
            // though its label follows the UI language.
            dir="ltr"
            inputClassName="text-start"
          />
          <ControlledTextInput<LoginFormSchemaValues>
            name="password"
            type="password"
            autoComplete="current-password"
            label={t('app:password')}
            required
            dir="ltr"
            inputClassName="text-start"
          />

          <Button type="submit" loading={login.isPending} className="w-full">
            {t('app:signIn')}
          </Button>

          <p className="flex items-start gap-1.5 text-paragraph-xs text-sub-dark">
            <ShieldCheck size={14} className="mt-px shrink-0" />
            {t('auth:sessionHint')}
          </p>
        </Form>
      </Card>
    </AuthLayout>
  );
}
