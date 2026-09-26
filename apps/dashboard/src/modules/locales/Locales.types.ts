import type {
  CreateLocalePayload,
  PaginationParams,
} from '@cms/contracts';

export type LocalesParams = PaginationParams & { isActive?: boolean };

export type CreateLocaleFormValues = CreateLocalePayload;
