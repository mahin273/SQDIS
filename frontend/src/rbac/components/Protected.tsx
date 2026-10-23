import React from 'react'
import type { PermissionString, UserRole, PermissionCheckContext } from '../types'
import { usePermission, useRole, useAnyRole } from '../hooks'

export interface ProtectedProps {
  children: React.ReactNode
  permission?: PermissionString
  requiredRole?: UserRole
  requiredRoles?: UserRole[]
  context?: PermissionCheckContext
  fallback?: React.ReactNode
}

export function Protected({
  children,
  permission,
  requiredRole,
  requiredRoles,
  context,
  fallback = null,
}: ProtectedProps) {
  const permResult = permission ? usePermission(permission, context) : { hasPermission: true }
  const hasPerm = permResult.hasPermission
  const hasSingleRole = requiredRole ? useRole(requiredRole) : true
  const hasMultipleRoles = requiredRoles && requiredRoles.length > 0 ? useAnyRole(requiredRoles) : true

  if (permission && !hasPerm) {
    return <>{fallback}</>
  }

  if (requiredRole && !hasSingleRole) {
    return <>{fallback}</>
  }

  if (requiredRoles && requiredRoles.length > 0 && !hasMultipleRoles) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
