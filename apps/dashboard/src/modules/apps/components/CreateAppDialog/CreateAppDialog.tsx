import {
  Button,
  ControlledSelect,
  ControlledTextInput,
  Form,
  Modal,
} from '@cms/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';


/**
 * Reference data, not another feature's state.
 *
 * `dashboard-module-structure.md` says modules never import from one another,
 * and this is the one documented exception: the locale list is app-wide
 * reference data with a single query key in `@/helpers`, and duplicating the
 * query per module would give it three keys and break the invalidation
 * contract — a worse outcome than the import. Everything app-SCOPED reaches
 * pages through `AppLayout`'s outlet context instead.
 */
import { useGetLocales } from '@/modules/locales/services';

import { useCreateApp } from '../../services';
import { type AppFormValues, useAppFormSchema } from '../../validations';

import type { CreateAppDialogProps } from './CreateAppDialog.types';

const DEFAULT_VALUES: AppFormValues = {
  name: '',
  slug: '',
  description: '',
  defaultLocaleCode: '',
};

export function CreateAppDialog({ open, onOpenChange }: CreateAppDialogProps) {
  const { t } = useTranslation(['apps', 'app']);
  const schema = useAppFormSchema();
  const createApp = useCreateApp();
  const { data: locales } = useGetLocales({ limit: 100 });

  const localeOptions = (locales?.records ?? [])
    .filter((locale) => locale.isActive)
    .map((locale) => ({
      value: locale.code,
      label: `${locale.code} · ${locale.nativeName}`,
    }));

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSubmit(values: AppFormValues) {
    await createApp.mutateAsync({
      ...values,
      description: values.description || null,
    });
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('apps:createAppTitle')}
      headerSubtitle={t('apps:createAppSubtitle')}
      closeLabel={t('app:close')}
    >
      <Form<AppFormValues>
        resolver={zodResolver(schema)}
        defaultValues={DEFAULT_VALUES}
        onSubmit={handleSubmit}
      >
        <ControlledTextInput<AppFormValues>
          name="name"
          label={t('apps:appName')}
          required
        />
        <ControlledTextInput<AppFormValues>
          name="slug"
          label={t('apps:appSlug')}
          helper={t('apps:appSlugHelper')}
          required
          // A slug is a URL fragment: LTR in every locale.
          dir="ltr"
          inputClassName="text-start font-mono"
        />
        <ControlledSelect<AppFormValues>
          name="defaultLocaleCode"
          label={t('apps:defaultLocale')}
          required
          options={localeOptions}
        />
        <ControlledTextInput<AppFormValues>
          name="description"
          label={t('apps:appDescription')}
          optional
          optionalText={t('app:optional')}
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
          <Button type="submit" size="small" loading={createApp.isPending}>
            {t('app:create')}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
