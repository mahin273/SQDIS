import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '@/types'
import { useAuthStore, useOrganizationStore } from '@/stores'
import { PageLoader } from '@/components/common/PageLoader'
import { logAuthzFailure } from '@/rbac/errors'

const roleRank: Record<UserRole, number> = {
  DEVELOPER: 1,
  TEAM_LEAD: 2,
  ADMIN: 3,
  OWNER: 4,
}

interface ProtectedRouteProps {
  requiredRole?: UserRole
  requiredRoles?: UserRole[]
  redirectTo?: string
  setupPath?: string
  forbiddenPath?: string
}

function getEffectiveRole(userRole?: UserRole, organizationRole?: UserRole): UserRole | undefined {
  return organizationRole ?? userRole
}

function hasRequiredRole(role: UserRole | undefined, requiredRole?: UserRole, requiredRoles?: UserRole[]) {
  if (!requiredRole && (!requiredRoles || requiredRoles.length === 0)) {
    return true
  }

  if (!role) {
    return false
  }

  if (requiredRoles && requiredRoles.length > 0) {
    return requiredRoles.includes(role)
  }

  return requiredRole ? roleRank[role] >= roleRank[requiredRole] : true
}

export function ProtectedRoute({
  requiredRole,
  requiredRoles,
  redirectTo = '/login',
  setupPath = '/setup/organization',
  forbiddenPath = '/forbidden',
}: ProtectedRouteProps = {}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizations = useOrganizationStore((state) => state.organizations)
  const fetchOrganizations = useOrganizationStore((state) => state.fetchOrganizations)
  const isHydrated = useOrganizationStore((state) => state.isHydrated)
  const [isLoading, setIsLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    let isMounted = true

    const hydrateOrganizations = async () => {
      if (!isAuthenticated) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      if (!isHydrated) {
        return
      }

      if (!currentOrganization || !currentOrganization.role) {
        await fetchOrganizations()
      }

      if (isMounted) {
        setIsLoading(false)
      }
    }

    hydrateOrganizations()

    return () => {
      isMounted = false
    }
  }, [currentOrganization, fetchOrganizations, isAuthenticated, isHydrated])

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }

  // Show loader while fetching organizations
  if (isLoading || !isHydrated) {
    return <PageLoader />
  }

  // Redirect to setup if no organization exists (except if already on setup page)
  if (!currentOrganization && organizations.length === 0 && !location.pathname.startsWith('/setup')) {
    return <Navigate to={setupPath} replace />
  }

  const role = getEffectiveRole(user?.role, currentOrganization?.role)

  if (!hasRequiredRole(role, requiredRole, requiredRoles)) {
    logAuthzFailure({
      userId: user?.id,
      userRole: role,
      attemptedRoute: location.pathname,
      attemptedAction: requiredRole || (requiredRoles ? requiredRoles.join(',') : 'access_route'),
      reason: 'Role insufficient for route requirement',
    })
    return <Navigate to={forbiddenPath} replace state={{ from: location }} />
  }

  return <Outlet />
}
