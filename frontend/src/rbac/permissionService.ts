import type { UserRole, PermissionString, PermissionCheckContext, PermissionCheckResult } from './types'
import { PERMISSION_MATRIX, hasRoleLevel } from './config'

export class PermissionService {
  public hasPermission(
    userRole: UserRole | null | undefined,
    permission: PermissionString,
    context?: PermissionCheckContext
  ): PermissionCheckResult {
    if (!userRole) {
      return { hasPermission: false, reason: 'User has no assigned role' }
    }

    const userPermissions = PERMISSION_MATRIX[userRole] || []

    // Global wildcard (OWNER)
    if (userPermissions.includes('*')) {
      return { hasPermission: true }
    }

    // Exact match
    if (userPermissions.includes(permission)) {
      return { hasPermission: true }
    }

    // Match with scope fallback (e.g., checking 'teams:view' when user has 'teams:view:team')
    const parts = permission.split(':')
    if (parts.length === 2) {
      const scopedMatch = userPermissions.some((p) => p.startsWith(`${permission}:`))
      if (scopedMatch) {
        return { hasPermission: true }
      }
    }

    // Contextual evaluation if scope is present in user permissions
    if (context && parts.length >= 2) {
      const category = parts[0]
      const action = parts[1]

      if (userPermissions.includes(`${category}:${action}:own` as PermissionString)) {
        if (context.userId && context.resourceOwnerId && context.userId === context.resourceOwnerId) {
          return { hasPermission: true }
        }
      }

      if (userPermissions.includes(`${category}:${action}:team` as PermissionString)) {
        if (context.teamId) {
          return { hasPermission: true }
        }
      }
    }

    return {
      hasPermission: false,
      reason: `Role '${userRole}' lacks permission '${permission}'`,
    }
  }

  public hasRole(userRole: UserRole | null | undefined, requiredRole: UserRole): boolean {
    if (!userRole) return false
    return hasRoleLevel(userRole, requiredRole)
  }

  public hasAnyRole(userRole: UserRole | null | undefined, requiredRoles: UserRole[]): boolean {
    if (!userRole) return false
    return requiredRoles.some((role) => hasRoleLevel(userRole, role))
  }
}

export const permissionService = new PermissionService()
