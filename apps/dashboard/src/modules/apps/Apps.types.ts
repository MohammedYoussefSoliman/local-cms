import type {
  CreateAppPayload,
  CreateTranslationModulePayload,
  PaginationParams,
} from '@cms/contracts';

export type AppsParams = PaginationParams;

export type ModulesParams = PaginationParams & { appId: string };

export type CreateAppFormValues = CreateAppPayload;

export type CreateModuleFormValues = CreateTranslationModulePayload;
