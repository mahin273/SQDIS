export type UserRole = 'OWNER' | 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER';

export type PermissionCategory =
  | 'organization'
  | 'members'
  | 'teams'
  | 'projects'
  | 'sprints'
  | 'releases'
  | 'metrics'
  | 'audit'
  | 'settings'
  | 'integrations'
  | 'onboarding'
  | 'reviews'
  | 'goals'
  | 'reports'
  | 'alerts'
  | 'debt';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'manage'
  | 'export'
  | 'assign'
  | 'approve'
  | 'remove-request';

export type PermissionScope = 'all' | 'team' | 'own' | 'organization';

export type PermissionString =
  | `${PermissionCategory}:${PermissionAction}`
  | `${PermissionCategory}:${PermissionAction}:${PermissionScope}`
  | '*';

export interface PermissionCheckContext {
  organizationId?: string;
  teamId?: string;
  userId?: string;
  resourceOwnerId?: string;
  [key: string]: unknown;
}

export interface PermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
}
