import { IsIn, IsOptional, IsString, Length } from 'class-validator';

import type { UpdateUserPayload } from '@cms/contracts';
import type { UserRole } from '@cms/domain';

const ROLES: UserRole[] = ['admin', 'editor'];

/**
 * `email` and `status` are deliberately absent, so `forbidNonWhitelisted`
 * rejects an attempt to change either through here — see `UpdateUserPayload`
 * for why each one has its own path or none at all.
 */
export class UpdateUserDto implements UpdateUserPayload {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;
}
