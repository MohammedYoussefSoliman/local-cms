import {
  Button,
  ControlledSelect,
  ControlledTextInput,
  Form,
  Modal,
} from '@cms/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';


import { useCreateLocale } from '../../services';
import {
  type LocaleFormValues,
  useLocaleFormSchema,
} from '../../validations';

const DEFAULT_VALUES: LocaleFormValues = {
  code: '',
  name: '',
  nativeName: '',
  direction: 'ltr',
};

export type CreateLocaleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateLocaleDialog({
  open,
  onOpenChange,
}: CreateLocaleDialogProps) {
  const { t } = useTranslation(['locales', 'app']);
  const schema = useLocaleFormSchema();
  const createLocale = useCreateLocale();

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSubmit(values: LocaleFormValues) {
    await createLocale.mutateAsync(values);
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('locales:createTitle')}
      headerSubtitle={t('locales:createSubtitle')}
      closeLabel={t('app:close')}
    >
      <Form<LocaleFormValues>
        resolver={zodResolver(schema)}
        defaultValues={DEFAULT_VALUES}
        onSubmit={handleSubmit}
      >
        <ControlledTextInput<LocaleFormValues>
          name="code"
          label={t('locales:code')}
          helper={t('locales:codeHelper')}
          required
          // A BCP 47 tag is a technical string.
          dir="ltr"
          inputClassName="text-start font-mono"
        />
        <ControlledTextInput<LocaleFormValues>
          name="name"
          label={t('locales:name')}
          required
          dir="ltr"
          inputClassName="text-start"
        />
        {/* The endonym is written in its OWN language, so its direction is
            whatever the new locale's is — which the user is choosing below.
            Left to inherit rather than pinned to either. */}
        <ControlledTextInput<LocaleFormValues>
          name="nativeName"
          label={t('locales:nativeName')}
          required
        />
        <ControlledSelect<LocaleFormValues>
          name="direction"
          label={t('locales:direction')}
          required
          options={[
            { value: 'ltr', label: t('locales:directionLtr') },
            { value: 'rtl', label: t('locales:directionRtl') },
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
          <Button type="submit" size="small" loading={createLocale.isPending}>
            {t('app:create')}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
