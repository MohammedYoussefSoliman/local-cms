import { Badge, Button, LtrText } from '@cms/ui';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { TranslationModuleResponseData } from '@cms/contracts';

type ModuleRowProps = {
  module: TranslationModuleResponseData;
  appSlug: string | undefined;
  onOpen: (module: TranslationModuleResponseData) => void;
};

export function ModuleRow({ module, appSlug, onOpen }: ModuleRowProps) {
  const { t } = useTranslation('apps');

  function handleOpen() {
    onOpen(module);
  }

  const endpoint =
    module.scope === 'global'
      ? `/v1/apps/:app/locales/:code/modules/${module.slug}`
      : `/v1/apps/${appSlug ?? ':app'}/locales/:code/modules/${module.slug}`;

  return (
    <tr className="border-b border-soft-light last:border-b-0 hover:bg-weak">
      <td className="p-3 text-paragraph-sm text-strong">{module.name}</td>
      <td className="p-3">
        <LtrText mono className="text-paragraph-sm text-sub-dark">
          {module.slug}
        </LtrText>
      </td>
      <td className="w-px whitespace-nowrap p-3">
        <Badge
          size="md"
          variant={module.scope === 'global' ? 'lighter' : 'light'}
          color={module.scope === 'global' ? 'blue' : 'gray'}
        >
          {module.scope}
        </Badge>
      </td>
      <td className="p-3">
        <LtrText mono className="truncate text-paragraph-xs text-sub-dark">
          {endpoint}
        </LtrText>
      </td>
      <td className="w-px whitespace-nowrap p-3 text-end">
        <Button type="button" size="xs" variant="ghost" onClick={handleOpen}>
          {t('open')}
          {/* Directional: it points forward along the reading flow. */}
          <ChevronRight size={14} className="rtl:-scale-x-100" />
        </Button>
      </td>
    </tr>
  );
}
