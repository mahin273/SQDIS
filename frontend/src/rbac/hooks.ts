import type { PermissionString, UserRole, PermissionCheckContext, PermissionCheckResult } from './types'
import { permissionService } from './permissionService'
import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { NAV_CONFIG, type NavItemConfig } from './navigationConfig'

const VALID_ROLES: ReadonlyArray<UserRole> = ['OWNER', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER']

export function useUserRole(): UserRole | null {
  const user = useAuthStore((state) => state.user)
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)

  if (!currentOrganization?.id || !user) {
    return null
  }

  // 1. Authoritative active organization context role
  if (currentOrganization.role && VALID_ROLES.includes(currentOrganization.role)) {
    return currentOrganization.role
  }

  // 2. Verified membership in the specific active organization
  if (user.memberships && user.memberships.length > 0) {
    const activeMembership = user.memberships.find((m) => m.organizationId === currentOrganization.id)
    if (activeMembership?.role && VALID_ROLES.includes(activeMembership.role)) {
      return activeMembership.role
    }
  }

  // Fail-closed: Never default to another organization's role or unverified role
  return null
}

export function usePermission(
  permission: PermissionString,
  context?: PermissionCheckContext
): PermissionCheckResult {
  const role = useUserRole()
  return permissionService.hasPermission(role, permission, context)
}

export function useRole(requiredRole: UserRole): boolean {
  const role = useUserRole()
  return permissionService.hasRole(role, requiredRole)
}

export function useAnyRole(requiredRoles: UserRole[]): boolean {
  const role = useUserRole()
  return permissionService.hasAnyRole(role, requiredRoles)
}

export function useFilteredNavigation(): NavItemConfig[] {
  const role = useUserRole()

  return NAV_CONFIG.filter((item) => {
    if (item.requiredRole && !permissionService.hasRole(role, item.requiredRole)) {
      return false
    }
    if (item.requiredPermission && !permissionService.hasPermission(role, item.requiredPermission).hasPermission) {
      return false
    }
    return true
  })
}
