import { api, tokenManager } from './api';
import type {
  User,
  Organization,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  GoogleAuthResponse,
  GitHubAuthResponse,
} from '../types/api.types';

/**
 * Auth API Client
 * Handles authentication and user management
 */
export const authApi = {
  /**
   * Register a new user
   */
  register: async (data: RegisterRequest): Promise<LoginResponse> => {
    const name =
      data.name?.trim() ||
      [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
      data.email.split('@')[0];

    const response = await api.post<LoginResponse>('/auth/register', {
      email: data.email,
      password: data.password,
      name,
    });
    if (response.data.accessToken && response.data.refreshToken) {
      tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    return response.data;
  },

  /**
   * Login user
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    if (response.data.accessToken && response.data.refreshToken) {
      tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    return response.data;
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (data: RefreshTokenRequest): Promise<RefreshTokenResponse> => {
    const response = await api.post<RefreshTokenResponse>('/auth/refresh', data);
    if (response.data.accessToken && response.data.refreshToken) {
      tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenManager.clearTokens();
    }
  },

  /**
   * Request password reset
   */
  forgotPassword: async (data: ForgotPasswordRequest): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  },

  /**
   * Reset password with token
   */
  resetPassword: async (data: ResetPasswordRequest): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },

  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl: async (): Promise<GoogleAuthResponse> => {
    const response = await api.get<GoogleAuthResponse>('/auth/google');
    return response.data;
  },

  /**
   * Handle Google OAuth callback
   */
  handleGoogleCallback: async (code: string, state?: string): Promise<LoginResponse> => {
    const response = await api.get<LoginResponse>('/auth/google/callback', {
      params: { code, state },
    });
    if (response.data.accessToken && response.data.refreshToken) {
      tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    return response.data;
  },

  /**
   * Get GitHub OAuth URL
   */
  getGitHubAuthUrl: async (): Promise<GitHubAuthResponse> => {
    const response = await api.get<GitHubAuthResponse>('/auth/github');
    return response.data;
  },

  /**
   * Handle GitHub OAuth callback
   */
  handleGitHubCallback: async (code: string, state?: string): Promise<LoginResponse> => {
    const response = await api.get<LoginResponse>('/auth/github/callback', {
      params: { code, state },
    });
    if (response.data.accessToken && response.data.refreshToken) {
      tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    return response.data;
  },

  /**
   * Get user's organizations
   */
  getOrganizations: async (): Promise<Organization[]> => {
    const response = await api.get<Organization[]>('/auth/organizations');
    return response.data;
  },

  /**
   * Switch to a different organization
   */
  switchOrganization: async (organizationId: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/switch-organization', { organizationId });
    if (response.data.accessToken && response.data.refreshToken) {
      tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    return response.data;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return !!tokenManager.getAccessToken();
  },

  /**
   * Check if access token is expired
   */
  isTokenExpired: (): boolean => {
    const token = tokenManager.getAccessToken();
    return !token || tokenManager.isTokenExpired(token);
  },
};

export default authApi;
