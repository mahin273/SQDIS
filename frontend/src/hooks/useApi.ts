import { useState, useCallback } from 'react';
import { AxiosError } from 'axios';
import type { ApiError } from '../types/api.types';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Custom hook for handling API calls with loading and error states
 * 
 * @example
 * const { data, loading, error, call } = useApi<LoginResponse>(authApi.login);
 * 
 * const handleLogin = async (credentials) => {
 *   const result = await call(credentials);
 *   if (result) {
 *     // Success
 *   }
 * };
 */
export const useApi = <T, TArgs extends unknown[]>(
  apiFunction: (...args: TArgs) => Promise<T>
): UseApiState<T> & { call: (...args: TArgs) => Promise<T | null>; reset: () => void } => {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const call = useCallback(
    async (...args: TArgs): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await apiFunction(...args);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const error = err as AxiosError<ApiError>;
        const apiError: ApiError = {
          message: error.response?.data?.message || error.message || 'An error occurred',
          statusCode: error.response?.status || 500,
          error: error.response?.data?.error,
          details: error.response?.data?.details,
        };
        setState({ data: null, loading: false, error: apiError });
        return null;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, call, reset };
};

/**
 * Hook for mutation operations (POST, PUT, PATCH, DELETE)
 * Useful for non-idempotent operations
 */
export const useMutation = <TData, TResponse,>(
  mutationFn: (data: TData) => Promise<TResponse>
): {
  mutate: (data: TData) => Promise<TResponse | null>;
  reset: () => void;
} & UseApiState<TResponse> => {
  const [state, setState] = useState<UseApiState<TResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(
    async (data: TData): Promise<TResponse | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await mutationFn(data);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const error = err as AxiosError<ApiError>;
        const apiError: ApiError = {
          message: error.response?.data?.message || error.message || 'An error occurred',
          statusCode: error.response?.status || 500,
          error: error.response?.data?.error,
          details: error.response?.data?.details,
        };
        setState({ data: null, loading: false, error: apiError });
        return null;
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, mutate, reset };
};

export default useApi;
