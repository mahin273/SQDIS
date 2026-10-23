import React from 'react'
import type { PermissionString, UserRole, PermissionCheckContext } from '../types'
import { usePermission, useRole, useAnyRole } from '../hooks'

export interface ProtectedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string
  to?: string
  permission?: PermissionString
  requiredRole?: UserRole
  requiredRoles?: UserRole[]
  context?: PermissionCheckContext
  fallbackMode?: 'hide' | 'disabled'
}

export function ProtectedLink({
  children,
  href,
  to,
  permission,
  requiredRole,
  requiredRoles,
  context,
  fallbackMode = 'hide',
  ...props
}: ProtectedLinkProps) {
  const permResult = permission ? usePermission(permission, context) : { hasPermission: true }
  const hasSingleRole = requiredRole ? useRole(requiredRole) : true
  const hasMultipleRoles = requiredRoles && requiredRoles.length > 0 ? useAnyRole(requiredRoles) : true

  const hasPerm = permResult.hasPermission
  const roleCheck = hasSingleRole
  const rolesCheck = hasMultipleRoles

  const isAllowed = hasPerm && roleCheck && rolesCheck
  const targetPath = to || href || '#'

  if (!isAllowed) {
    if (fallbackMode === 'hide') {
      return null
    }
    return (
      <span className={`${props.className || ''} opacity-50 cursor-not-allowed text-gray-400`}>
        {children}
      </span>
    )
  }

  return (
    <a href={targetPath} {...props}>
      {children}
    </a>
  )
}
