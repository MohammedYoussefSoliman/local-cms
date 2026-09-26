import { useTranslation } from 'react-i18next';


import { ModuleRow } from './ModuleRow';
import { ModulesTableSkeleton } from './ModulesTableSkeleton';

import type { ModulesTableProps } from './ModulesTable.types';

export function ModulesTable({
  modules,
  isLoading,
  appSlug,
  onOpen,
}: ModulesTableProps) {
  const { t } = useTranslation('apps');

  if (isLoading) return <ModulesTableSkeleton />;

  return (
    <div className="overflow-x-auto rounded-12 border border-soft-light bg-white">
      <table className="w-full">
        <thead>
          <tr className="bg-weak">
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colModule')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colSlug')}
            </th>
            <th className="w-px p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colScope')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colEndpoint')}
            </th>
            <th className="w-px p-3" />
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <ModuleRow
              key={module.id}
              module={module}
              appSlug={appSlug}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
