import axios, { AxiosError } from 'axios';
import type { AxiosInstance } from 'axios';
import type { ApiError } from '../types/api.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * Token Manager - handles JWT token storage and retrieval
 */
export const tokenManager = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
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
 * Create Axios instance with base configuration
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - attach JWT token
  client.interceptors.request.use(
    (config) => {
      const token = tokenManager.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle 401 and refresh token with single-flight refresh
  let isRefreshing = false;
  let refreshSubscribers: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
  }> = [];

  const redirectToSignIn = () => {
    window.location.href = '/signin';
  };

  const subscribeTokenRefresh = (
    resolve: (token: string) => void,
    reject: (error: unknown) => void
  ) => {
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

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiError>) => {
      const originalRequest = (error.config || {}) as any;

      if (error.response?.status === 401 && !originalRequest._retry) {
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
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(client(originalRequest));
            }, reject);
          });
        }

        isRefreshing = true;

        try {
          const response = await axios.post<{ accessToken: string; refreshToken: string }>(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          tokenManager.setTokens(accessToken, newRefreshToken);
          onRefreshed(accessToken);
          isRefreshing = false;

          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return client(originalRequest);
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

  return client;
};

export const apiClient = createApiClient();

export default apiClient;
