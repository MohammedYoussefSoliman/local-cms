import type { User, UserRole } from '@cms/domain';

/**
 * An invitation, not a full account. There is no `password` and no `status`:
 * the account is created `invited` and cannot be logged into until it has both
 * a password and `active` status.
 */
export type CreateUserPayload = {
  email: string;
  name: string;
  role: UserRole;
};

/**
 * `email` is absent — it is the login identity and the CITEXT-unique column, so
 * changing it is an account migration rather than a field edit. `status` is
 * absent too: that is what `disable` and `enable` are for, and they have side
 * effects (revoking every session) that a general-purpose PATCH would hide.
 */
export type UpdateUserPayload = {
  name?: string;
  role?: UserRole;
};

export type ChangePasswordPayload = {
  /** Proves the session belongs to the person, not just to the browser. */
  currentPassword: string;
  newPassword: string;
};

export type UserResponseData = User & {
  createdAt: string;
  updatedAt: string;
};
