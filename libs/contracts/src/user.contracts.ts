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

/**
 * An outstanding invitation, as the dashboard lists it. No token: the
 * plaintext exists only in the response that mints it.
 */
export type InvitationResponseData = {
  id: string;
  userId: string;
  expiresAt: string;
  invitedBy: string | null;
  createdAt: string;
};

/**
 * The one response that carries the plaintext token, returned by creating a
 * user and by re-issuing an invitation. It is shown to the admin once and is
 * unrecoverable afterwards — the same contract `POST /apps/:id/api-keys` has.
 *
 * `acceptUrl` is the link to hand to the invitee; there is no mail transport
 * in the CMS, so delivering it is the admin's move.
 */
export type IssuedInvitationResponseData = InvitationResponseData & {
  token: string;
  acceptUrl: string;
};

/** `POST /users` — the account, plus the invitation it just minted. */
export type InvitedUserResponseData = UserResponseData & {
  invitation: IssuedInvitationResponseData;
};

/**
 * What the accept screen renders. Deliberately narrow: the caller holds an
 * invitation token, not a session, so this returns only what is needed to say
 * "you were invited as an editor, pick a password" — no id, no status.
 */
export type InvitationPreviewResponseData = {
  email: string;
  name: string;
  role: UserRole;
  expiresAt: string;
};

/** The first password. There is no `currentPassword` — there is no current one. */
export type AcceptInvitationPayload = {
  password: string;
};
