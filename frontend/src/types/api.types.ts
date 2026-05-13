/**
 * Shared API Types
 */

// ============== AUTH TYPES ==============
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  organizationId?: string;
  role?: UserRole;
  memberships?: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: UserRole;
    joinedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  VIEWER: 'VIEWER',
} as const;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthTokens {
  expiresIn?: number;
  tokenType?: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse extends AuthTokens {}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface GoogleAuthResponse {
  url: string;
}

export interface GitHubAuthResponse {
  url: string;
}

// ============== ORGANIZATIONS TYPES ==============
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  logoUrl?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
  logoUrl?: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: MemberRole;
  user: User;
  joinedAt: string;
}

export type MemberRole = typeof MEMBER_ROLES[keyof typeof MEMBER_ROLES];
export const MEMBER_ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export interface InviteRequest {
  email: string;
  role?: MemberRole;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface UpdateMemberRequest {
  role: MemberRole;
}

// ============== AUDIT LOGS TYPES ==============
export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  granted?: boolean | null;
  requiredRole?: string | null;
  userRole?: string | null;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  severity?: AuditSeverity | null;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export type AuditSeverity = typeof AUDIT_SEVERITIES[keyof typeof AUDIT_SEVERITIES];
export const AUDIT_SEVERITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export interface QueryAuditLogsRequest {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  action?: string[];
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExportAuditLogsRequest {
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string[];
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity;
}

export type ExportFormat = typeof EXPORT_FORMATS[keyof typeof EXPORT_FORMATS];
export const EXPORT_FORMATS = {
  CSV: 'CSV',
  JSON: 'JSON',
  PDF: 'PDF',
} as const;

export interface Export {
  id: string;
  format: ExportFormat;
  status: ExportStatus;
  downloadUrl?: string;
  createdAt: string;
  expiresAt: string;
}

export type ExportStatus = typeof EXPORT_STATUSES[keyof typeof EXPORT_STATUSES];
export const EXPORT_STATUSES = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;

export interface RetentionPolicy {
  id: string;
  organizationId: string;
  retentionDays: number;
  autoDelete: boolean;
  updatedAt: string;
}

export interface UpdateRetentionPolicyRequest {
  retentionDays: number;
  autoDelete: boolean;
}

export interface ActionCountsAnalytics {
  action: string;
  count: number;
}

export interface ActiveUsersAnalytics {
  userId: string;
  count: number;
  lastActive: string;
}

export interface FailedPermissionsAnalytics {
  resource: string;
  count: number;
  severity: AuditSeverity;
}

export interface TimelineAnalytics {
  timestamp: string;
  count: number;
}

export interface TopResourcesAnalytics {
  resource: string;
  count: number;
}

export interface GDPRDataAccessResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ComplianceReportRequest {
  reportType: 'SOC2' | 'GDPR' | 'HIPAA';
  startDate?: string;
  endDate?: string;
}

export interface ComplianceReport {
  id: string;
  organizationId: string;
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalEvents: number;
    criticalEvents: number;
    failedAttempts: number;
    uniqueUsers: number;
  };
  topActions: ActionCountsAnalytics[];
  topResources: TopResourcesAnalytics[];
}

// ============== API ERROR TYPES ==============
export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// ============== PAGINATION ==============
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortOrder?: 'asc' | 'desc';
}
