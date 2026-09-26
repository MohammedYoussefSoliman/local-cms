import {
  Button,
  ControlledSelect,
  ControlledTextInput,
  Form,
  Modal,
} from '@cms/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';


import { useCreateEntry } from '../../services';
import {
  type EntryFormValues,
  useEntryFormSchema,
} from '../../validations';

const DEFAULT_VALUES: EntryFormValues = {
  key: '',
  description: '',
  contentType: 'text',
};

export type CreateEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
};

export function CreateEntryDialog({
  open,
  onOpenChange,
  moduleId,
}: CreateEntryDialogProps) {
  const { t } = useTranslation(['translations', 'app']);
  const schema = useEntryFormSchema();
  const createEntry = useCreateEntry(moduleId);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSubmit(values: EntryFormValues) {
    await createEntry.mutateAsync({
      ...values,
      description: values.description || null,
    });
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('translations:createKeyTitle')}
      headerSubtitle={t('translations:createKeySubtitle')}
      closeLabel={t('app:close')}
    >
      <Form<EntryFormValues>
        resolver={zodResolver(schema)}
        defaultValues={DEFAULT_VALUES}
        onSubmit={handleSubmit}
      >
        <ControlledTextInput<EntryFormValues>
          name="key"
          label={t('translations:key')}
          helper={t('translations:keyHelper')}
          required
          // A translation key is what code passes to t() — LTR everywhere.
          dir="ltr"
          inputClassName="text-start font-mono"
        />
        <ControlledTextInput<EntryFormValues>
          name="description"
          label={t('translations:description')}
          helper={t('translations:descriptionHelper')}
          optional
          optionalText={t('app:optional')}
        />
        <ControlledSelect<EntryFormValues>
          name="contentType"
          label={t('translations:contentType')}
          options={[
            { value: 'text', label: t('translations:contentTypeText') },
            { value: 'rich_text', label: t('translations:contentTypeRichText') },
            { value: 'icu_message', label: t('translations:contentTypeIcu') },
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
          <Button type="submit" size="small" loading={createEntry.isPending}>
            {t('app:create')}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
