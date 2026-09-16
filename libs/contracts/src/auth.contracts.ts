import type { User } from '@cms/domain';

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthTokens = {
  accessToken: string;
  /** Omitted when the dashboard receives it as an HttpOnly cookie instead. */
  refreshToken?: string;
  expiresIn: number;
};

export type LoginResponseData = AuthTokens & { user: User };

export type RefreshPayload = { refreshToken: string };

export type CurrentUserResponseData = User & { permissions: string[] };
