import { Button, ControlledTextInput, Form, Modal } from '@cms/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';


import { useCreateModule } from '../../services';
import {
  type ModuleFormValues,
  useModuleFormSchema,
} from '../../validations';

const DEFAULT_VALUES: ModuleFormValues = {
  name: '',
  slug: '',
  description: '',
};

export type CreateModuleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `undefined` creates a GLOBAL module — scope comes from the route. */
  appId: string | undefined;
};

export function CreateModuleDialog({
  open,
  onOpenChange,
  appId,
}: CreateModuleDialogProps) {
  const { t } = useTranslation(['apps', 'app']);
  const schema = useModuleFormSchema();
  const createModule = useCreateModule(appId);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSubmit(values: ModuleFormValues) {
    await createModule.mutateAsync({
      ...values,
      description: values.description || null,
    });
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('apps:createModuleTitle')}
      headerSubtitle={t('apps:createModuleSubtitle')}
      closeLabel={t('app:close')}
    >
      <Form<ModuleFormValues>
        resolver={zodResolver(schema)}
        defaultValues={DEFAULT_VALUES}
        onSubmit={handleSubmit}
      >
        <ControlledTextInput<ModuleFormValues>
          name="name"
          label={t('apps:moduleName')}
          required
        />
        <ControlledTextInput<ModuleFormValues>
          name="slug"
          label={t('apps:moduleSlug')}
          required
          dir="ltr"
          inputClassName="text-start font-mono"
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
          <Button type="submit" size="small" loading={createModule.isPending}>
            {t('app:create')}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
