import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ApiError, ApiResponse } from '@/types';

const API_BASE_URL = '/api';

/**
 * Token storage keys
 */
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const ORGANIZATION_ID_KEY = 'organizationId';

/**
 * Token Manager - handles JWT token storage and retrieval
 */
export const tokenManager = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getOrganizationId: () => localStorage.getItem(ORGANIZATION_ID_KEY),

  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  setOrganizationId: (organizationId: string | null) => {
    if (organizationId) {
      localStorage.setItem(ORGANIZATION_ID_KEY, organizationId);
    } else {
      localStorage.removeItem(ORGANIZATION_ID_KEY);
    }
  },

  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ORGANIZATION_ID_KEY);
  },

  isTokenExpired: (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  },
};

/**
 * Backward-compatible exports used by existing code.
 */
export const getAccessToken = () => tokenManager.getAccessToken();
export const getRefreshToken = () => tokenManager.getRefreshToken();
export const clearTokens = () => tokenManager.clearTokens();
export const setCurrentOrganizationId = (orgId: string | null) =>
  tokenManager.setOrganizationId(orgId);

// Re-export setTokens with same name for compatibility
export const setTokens = (accessToken: string, refreshToken: string) =>
  tokenManager.setTokens(accessToken, refreshToken);

/**
 * Axios instance with:
 * - default baseURL = /api
 * - request auth header injection
 * - organization header injection (X-Organization-Id)
 * - refresh token flow on 401 (single-flight)
 * - backend { success, data } response unwrapping
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============== Request Interceptor ==============
api.interceptors.request.use((config) => {
  const token = tokenManager.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const orgId = tokenManager.getOrganizationId();
  if (orgId) {
    config.headers['X-Organization-Id'] = orgId;
  }

  return config;
});

// ============== Response Interceptor (401 Refresh + Unwrap) ==============

interface RefreshSubscriber {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let refreshSubscribers: RefreshSubscriber[] = [];

const redirectToSignIn = () => {
  // Avoid redirecting if already on the sign-in page
  if (!window.location.pathname.startsWith('/signin')) {
    window.location.href = '/signin';
  }
};

const subscribeTokenRefresh = (resolve: (token: string) => void, reject: (error: unknown) => void) => {
  refreshSubscribers.push({ resolve, reject });
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach(({ resolve }) => resolve(token));
  refreshSubscribers = [];
};

const onRefreshFailed = (error: unknown) => {
  refreshSubscribers.forEach(({ reject }) => reject(error));
  refreshSubscribers = [];
};

api.interceptors.response.use(
  (response) => {
    // Unwrap { success, data } shape if present
    const body = response.data as ApiResponse<unknown> | unknown;
    if (
      body &&
      typeof body === 'object' &&
      'success' in body &&
      'data' in body
    ) {
      const wrapped = body as ApiResponse<unknown>;
      if (wrapped.success) {
        response.data = wrapped.data;
      }
    }
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (originalRequest && error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) {
        tokenManager.clearTokens();
        redirectToSignIn();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request until token is refreshed
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          }, reject);
        });
      }

      isRefreshing = true;

      try {
        const response = await axios.post<any>(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const data = response.data?.data || response.data;
        const accessToken = data?.accessToken;
        const newRefreshToken = data?.refreshToken;

        if (!accessToken) {
          throw new Error('Refresh response missing access token');
        }

        tokenManager.setTokens(accessToken, newRefreshToken || refreshToken);
        onRefreshed(accessToken);
        isRefreshing = false;

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed(refreshError);
        tokenManager.clearTokens();
        redirectToSignIn();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;