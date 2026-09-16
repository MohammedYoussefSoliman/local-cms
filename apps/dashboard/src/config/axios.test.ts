import axios, { type AxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/store';

import { axiosInstance } from './axios';

/**
 * The refresh queue is the one piece of dashboard plumbing where a plausible
 * implementation is wrong: refresh tokens rotate, so six concurrent 401s that
 * each start their own refresh would have the first success revoke the token
 * the other five are still holding — and the API correctly treats that as
 * replay and kills the session.
 */
function mockAdapter(config: AxiosRequestConfig) {
  if (config.headers?.Authorization === 'Bearer expired') {
    return Promise.reject({
      config,
      isAxiosError: true,
      response: { status: 401, data: {}, headers: {}, config, statusText: '' },
    });
  }

  return Promise.resolve({
    data: { data: 'ok' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
}

describe('axiosInstance refresh flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axiosInstance.defaults.adapter = mockAdapter as any;

    useAuthStore.setState({
      accessToken: 'expired',
      refreshToken: 'refresh-1',
      user: {
        id: 'u1',
        email: 'editor@example.com',
        name: 'Editor',
        role: 'editor',
        status: 'active',
      },
    });
  });

  it('refreshes once for concurrent 401s and retries every request', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        data: { accessToken: 'fresh', refreshToken: 'refresh-2', expiresIn: 900 },
      },
    });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => axiosInstance.get('/apps')),
    );

    expect(post).toHaveBeenCalledTimes(1);
    expect(responses.map((response) => response.data)).toEqual([
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
    ]);
    expect(useAuthStore.getState().accessToken).toBe('fresh');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-2');
  });

  it('clears the session when the refresh itself fails', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh rejected'));

    await expect(axiosInstance.get('/apps')).rejects.toThrow();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('does not attempt a refresh for a 401 from an auth endpoint', async () => {
    const post = vi.spyOn(axios, 'post');

    await expect(axiosInstance.get('/auth/me')).rejects.toBeDefined();
    expect(post).not.toHaveBeenCalled();
  });
});
