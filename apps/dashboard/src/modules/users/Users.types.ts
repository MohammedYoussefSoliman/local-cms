import type { CreateUserPayload, PaginationParams } from '@cms/contracts';
import type { UserRole, UserStatus } from '@cms/domain';

export type UsersParams = PaginationParams & {
  role?: UserRole;
  status?: UserStatus;
};

export type InviteUserFormValues = CreateUserPayload;
