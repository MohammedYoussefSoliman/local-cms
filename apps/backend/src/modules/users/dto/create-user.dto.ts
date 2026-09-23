import { IsEmail, IsIn, IsString, Length } from 'class-validator';

import type { CreateUserPayload } from '@cms/contracts';
import type { UserRole } from '@cms/domain';

const ROLES: UserRole[] = ['admin', 'editor'];

export class CreateUserDto implements CreateUserPayload {
  @IsEmail()
  @Length(1, 255)
  email: string;

  @IsString()
  @Length(1, 255)
  name: string;

  /**
   * Required rather than defaulted to `editor`. Creating an account is the one
   * moment the role is fully in view, and a silent default is how an admin ends
   * up surprised by who can publish.
   */
  @IsIn(ROLES)
  role: UserRole;
}
