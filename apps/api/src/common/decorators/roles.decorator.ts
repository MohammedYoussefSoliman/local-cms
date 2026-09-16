import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '@cms/domain';

export const ROLES_KEY = 'roles';

/** Requires one of the listed roles. Runs after authentication. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
