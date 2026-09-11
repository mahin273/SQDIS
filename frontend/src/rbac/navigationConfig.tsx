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
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Quality Scores', path: '/scores' },
  { label: 'Code Intelligence', path: '/code-intelligence' },
  { label: 'Projects', path: '/projects', requiredPermission: 'projects:view' },
  { label: 'Teams', path: '/teams', requiredPermission: 'teams:view' },
  { label: 'Developers', path: '/developers' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'Commits', path: '/commits' },
  { label: 'Coverage', path: '/coverage' },
  { label: 'Reviews', path: '/reviews', requiredPermission: 'reviews:view' },
  { label: 'Sprints', path: '/sprints', requiredPermission: 'sprints:view' },
  { label: 'Releases', path: '/releases', requiredPermission: 'releases:view' },
  { label: 'Goals', path: '/goals', requiredPermission: 'goals:view' },
  { label: 'Tech Debt', path: '/debt', requiredPermission: 'debt:view' },
  { label: 'Alerts', path: '/alerts', requiredPermission: 'alerts:view' },

  // Operations & Admin
  { label: 'Reports', path: '/reports', requiredPermission: 'reports:view' },
  {
    label: 'Organization Members',
    path: '/dashboard/org-members',
    requiredPermission: 'organization:view',
  },
  {
    label: 'Onboarding',
    path: '/onboarding',
    requiredPermission: 'onboarding:view',
  },
  {
    label: 'Audit Logs',
    path: '/audit-logs',
    requiredRole: 'ADMIN',
    requiredPermission: 'audit:view',
  },
  {
    label: 'Audit Analytics',
    path: '/audit-logs/analytics',
    requiredRole: 'ADMIN',
    requiredPermission: 'audit:view',
  },
  {
    label: 'Real-Time Monitor',
    path: '/audit-logs/monitor',
    requiredRole: 'ADMIN',
    requiredPermission: 'audit:view',
  },
  { label: 'Settings', path: '/settings' },
]
