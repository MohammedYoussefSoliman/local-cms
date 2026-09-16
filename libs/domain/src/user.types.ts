export type UserRole = 'admin' | 'editor';

export type UserStatus = 'active' | 'invited' | 'disabled';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

/** JWT access-token payload. Validated on every protected request. */
export type AccessTokenClaims = {
  sub: string;
  email: string;
  role: UserRole;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
};
