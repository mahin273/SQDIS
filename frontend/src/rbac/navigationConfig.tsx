import type { UserRole, PermissionString } from './types'

export interface NavItemConfig {
  label: string
  path: string
  icon?: string
  requiredRole?: UserRole
  requiredPermission?: PermissionString
  children?: NavItemConfig[]
}

export const NAV_CONFIG: NavItemConfig[] = [
  // Core Intelligence & Insights
  { label: 'Dashboard', path: '/dashboard', requiredRole: 'DEVELOPER' },
  { label: 'Quality Scores', path: '/scores', requiredRole: 'DEVELOPER' },
  { label: 'Code Intelligence', path: '/code-intelligence', requiredRole: 'TEAM_LEAD' },
  { label: 'Projects', path: '/projects', requiredRole: 'DEVELOPER', requiredPermission: 'projects:view' },
  { label: 'Teams', path: '/teams', requiredRole: 'TEAM_LEAD', requiredPermission: 'teams:view' },
  { label: 'Developers', path: '/developers', requiredRole: 'TEAM_LEAD' },
  { label: 'Leaderboard', path: '/leaderboard', requiredRole: 'DEVELOPER' },
  { label: 'Commits', path: '/commits', requiredRole: 'DEVELOPER' },
  { label: 'Coverage', path: '/coverage', requiredRole: 'DEVELOPER' },
  { label: 'Reviews', path: '/reviews', requiredRole: 'DEVELOPER', requiredPermission: 'reviews:view' },
  { label: 'Sprints', path: '/sprints', requiredRole: 'DEVELOPER', requiredPermission: 'sprints:view' },
  { label: 'Releases', path: '/releases', requiredRole: 'DEVELOPER', requiredPermission: 'releases:view' },
  { label: 'Goals', path: '/goals', requiredRole: 'DEVELOPER', requiredPermission: 'goals:view' },
  { label: 'Tech Debt', path: '/debt', requiredRole: 'DEVELOPER', requiredPermission: 'debt:view' },
  { label: 'Alerts', path: '/alerts', requiredRole: 'DEVELOPER', requiredPermission: 'alerts:view' },

  // Operations & Admin
  { label: 'Reports', path: '/reports', requiredRole: 'TEAM_LEAD', requiredPermission: 'reports:view' },
  {
    label: 'Organization Members',
    path: '/dashboard/org-members',
    requiredRole: 'ADMIN',
    requiredPermission: 'members:view',
  },
  {
    label: 'Onboarding',
    path: '/onboarding',
    requiredRole: 'DEVELOPER',
    requiredPermission: 'onboarding:view',
  },
  {
    label: 'Audit Logs',
    path: '/audit-logs',
    requiredRole: 'ADMIN',
    requiredPermission: 'audit:view',
  },
  { label: 'Settings', path: '/settings', requiredRole: 'DEVELOPER' },
]
