import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authService, organizationService } from '@/services'
import { useAuthStore, useOrganizationStore } from '@/stores'
import type { LoginRequest, RegisterRequest } from '@/types'

export function useLoginMutation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)
  const setOrganizations = useOrganizationStore((state) => state.setOrganizations)

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: async (data) => {
      setUser(data.user)
      const redirect = searchParams.get('redirect')
      const invitationToken = searchParams.get('invitationToken')

      if (invitationToken) {
        navigate(`/invitations/${invitationToken}`)
        return
      }
      if (redirect) {
        navigate(redirect)
        return
      }

      // Fetch organizations
      try {
        const orgs = await organizationService.getAll()
        setOrganizations(orgs)

        if (orgs.length === 0) {
          navigate('/setup/organization')
        } else {
          navigate('/')
        }
      } catch {
        navigate('/')
      }

      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })
}

export function useRegisterMutation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: (credentials: RegisterRequest) => authService.register(credentials),
    onSuccess: (data) => {
      setUser(data.user)
      queryClient.invalidateQueries({ queryKey: ['user'] })
      const invitationToken = searchParams.get('invitationToken')
      const redirect = searchParams.get('redirect')
      if (invitationToken) {
        navigate(`/invitations/${invitationToken}`)
      } else if (redirect) {
        navigate(redirect)
      } else {
        navigate('/setup/organization')
      }
    },
  })
}

export function useLogoutMutation() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)
  const clearOrganization = useOrganizationStore((state) => state.clearOrganization)

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      setUser(null)
      clearOrganization()
      queryClient.clear()
      navigate('/login')
    },
    onError: () => {
      // Even on error, clear local state
      setUser(null)
      clearOrganization()
      queryClient.clear()
      navigate('/login')
    },
  })
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword({ identifier: email }),
  })
}

export function useResetPasswordMutation() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authService.resetPassword({ token, newPassword: password }),
    onSuccess: () => {
      navigate('/login')
    },
  })
}
