export type AuthErrorType = 'UNAUTHENTICATED' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN'
export type AuthzErrorType = 'FORBIDDEN' | 'INSUFFICIENT_ROLE' | 'INSUFFICIENT_PERMISSION'

export interface AuthzFailureDetails {
  userId?: string
  userRole?: string | null
  attemptedAction?: string
  attemptedRoute?: string
  reason: string
}

export function getAuthErrorMessage(errorType: AuthErrorType): string {
  switch (errorType) {
    case 'UNAUTHENTICATED':
      return 'You must be logged in to access this resource.'
    case 'TOKEN_EXPIRED':
      return 'Your session has expired. Please log in again.'
    case 'INVALID_TOKEN':
      return 'Invalid authentication token.'
    default:
      return 'Authentication error occurred.'
  }
}

export function getAuthzErrorMessage(errorType: AuthzErrorType): string {
  switch (errorType) {
    case 'FORBIDDEN':
      return 'You do not have access to this resource.'
    case 'INSUFFICIENT_ROLE':
      return 'Your role does not have sufficient privileges.'
    case 'INSUFFICIENT_PERMISSION':
      return 'You lack the required permission for this action.'
    default:
      return 'Authorization error occurred.'
  }
}

export function logAuthzFailure(details: AuthzFailureDetails) {
  console.warn('[RBAC Authz Failure]', {
    timestamp: new Date().toISOString(),
    ...details,
  })
}
