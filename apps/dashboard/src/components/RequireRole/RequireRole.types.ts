import type { UserRole } from '@cms/domain';

import type { ReactNode } from 'react';


export type RequireRoleProps = {
  role: UserRole;
  children: ReactNode;
}
