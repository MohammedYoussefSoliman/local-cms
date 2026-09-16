import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import type { AuthTokens, HTTPResponseType } from '@cms/contracts';

import { useAuthStore } from '@/store';

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * The single axios instance for the whole dashboard. Feature code imports this
 * — never `axios` directly, and never a second `axios.create()`, which would
 * miss the token injection and the refresh flow below.
 */
export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Refresh-and-retry, serialized.
 *
 * Concurrency is the whole difficulty: a page that fires six queries on mount
 * gets six 401s at once. Without this queue each one starts its own refresh,
 * and because refresh tokens rotate, the first success revokes the token the
 * other five are still using — which the API correctly treats as replay and
 * kills the session. So the first 401 owns the refresh and the rest wait on it.
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setAccessToken, setSession, user, clear } =
    useAuthStore.getState();

  if (!refreshToken) throw new Error('No refresh token available.');

  const response = await axios.post<HTTPResponseType<AuthTokens>>(
    `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
    { refreshToken },
  );

  const tokens = response.data.data;

  if (tokens.refreshToken && user) {
    setSession({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    });
  } else {
    setAccessToken(tokens.accessToken);
  }

  if (!tokens.accessToken) {
    clear();
    throw new Error('Refresh returned no access token.');
  }

  return tokens.accessToken;
}

axiosInstance.interceptors.response.use(
  // The API wraps every success in `{ data, message, statusCode }`; unwrap it
  // once here so `queryFn` returns the payload directly.
  (response) => {
    response.data = response.data?.data ?? response.data;
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    const isAuthEndpoint = config?.url?.includes('/auth/');
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    config._retried = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const accessToken = await refreshPromise;
      config.headers.Authorization = `Bearer ${accessToken}`;

      return axiosInstance(config as AxiosRequestConfig);
    } catch (refreshError) {
      useAuthStore.getState().clear();
      return Promise.reject(refreshError);
    }
  },
);
