import { IsIn, IsOptional } from 'class-validator';

import type { UserRole, UserStatus } from '@cms/domain';

import { PaginationQueryDto } from '@/common';

const ROLES: UserRole[] = ['admin', 'editor'];
const STATUSES: UserStatus[] = ['active', 'invited', 'disabled'];

/** `search` matches email or name — inherited from `PaginationQueryDto`. */
export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;

  @IsOptional()
  @IsIn(STATUSES)
  status?: UserStatus;
}
