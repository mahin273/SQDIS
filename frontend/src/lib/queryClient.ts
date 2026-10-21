import { QueryClient } from '@tanstack/react-query';

/**
 * Global QueryClient configuration with offline-first oriented settings.
 * - staleTime: 5 minutes - data is considered fresh for 5 minutes
 * - gcTime: 30 minutes - inactive queries are garbage collected after 30 minutes
 * - retry: avoids retrying most 4xx responses (client errors)
 * - networkMode: offlineFirst for queries and mutations
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry on 4xx client errors (except 429 rate limit)
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) {
          return false;
        }
        // Retry up to 3 times for other errors (5xx, network, etc.)
        return failureCount < 3;
      },
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

/**
 * Centralized query key factory by domain.
 * Use these keys to ensure consistent cache invalidation across the app.
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    organizations: ['auth', 'organizations'] as const,
  },
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    sqsTrend: (days?: number) => ['dashboard', 'sqs-trend', days ?? 30] as const,
    commitTrend: (days?: number) => ['dashboard', 'commit-trend', days ?? 30] as const,
    topRepositories: (limit?: number) => ['dashboard', 'top-repositories', limit ?? 5] as const,
    bottomRepositories: (limit?: number) => ['dashboard', 'bottom-repositories', limit ?? 5] as const,
    topDevelopers: (limit?: number) => ['dashboard', 'top-developers', limit ?? 5] as const,
    topTeams: (limit?: number) => ['dashboard', 'top-teams', limit ?? 5] as const,
    recentActivity: (limit?: number) => ['dashboard', 'recent-activity', limit ?? 10] as const,
    alerts: ['dashboard', 'alerts'] as const,
  },
  teams: {
    all: (organizationId?: string) => ['teams', 'all', organizationId ?? ''] as const,
    detail: (id: string) => ['teams', 'detail', id] as const,
    metrics: (id: string, query?: Record<string, unknown>) => ['teams', 'metrics', id, query] as const,
    leaderboard: (query?: Record<string, unknown>) => ['teams', 'leaderboard', query] as const,
  },
  projects: {
    all: (organizationId?: string) => ['projects', 'all', organizationId ?? ''] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
    metrics: (id: string) => ['projects', 'metrics', id] as const,
    debt: (id: string) => ['projects', 'debt', id] as const,
  },
  sprints: {
    all: (organizationId?: string, teamId?: string) => ['sprints', 'all', organizationId ?? '', teamId ?? ''] as const,
    detail: (id: string) => ['sprints', 'detail', id] as const,
    report: (id: string) => ['sprints', 'report', id] as const,
    burndown: (id: string) => ['sprints', 'burndown', id] as const,
    health: (id: string) => ['sprints', 'health', id] as const,
    contributions: (id: string) => ['sprints', 'contributions', id] as const,
    velocity: (teamId?: string) => ['sprints', 'velocity', teamId ?? ''] as const,
    timeline: (months?: number) => ['sprints', 'timeline', months ?? 3] as const,
    goals: (id: string) => ['sprints', 'goals', id] as const,
    retrospective: (id: string) => ['sprints', 'retrospective', id] as const,
    carryOvers: (id: string) => ['sprints', 'carry-overs', id] as const,
  },
  releases: {
    all: (organizationId?: string) => ['releases', 'all', organizationId ?? ''] as const,
    detail: (id: string) => ['releases', 'detail', id] as const,
    readiness: (id: string) => ['releases', 'readiness', id] as const,
  },
  reviews: {
    all: (filters?: Record<string, unknown>) => ['reviews', 'all', filters] as const,
    pending: ['reviews', 'pending'] as const,
    leaderboard: (limit?: number, repositoryId?: string) => ['reviews', 'leaderboard', limit ?? 10, repositoryId ?? 'all'] as const,
    analytics: (query?: Record<string, unknown>) => ['reviews', 'analytics', query] as const,
    qualityMetrics: (query?: Record<string, unknown>) => ['reviews', 'quality-metrics', query] as const,
    activityTrend: (days?: number, repositoryId?: string) => ['reviews', 'activity-trend', days ?? 30, repositoryId ?? 'all'] as const,
    peakTimes: (repositoryId?: string) => ['reviews', 'peak-times', repositoryId ?? 'all'] as const,
    repositories: ['reviews', 'repositories'] as const,
    debt: (teamId: string) => ['reviews', 'debt', teamId] as const,
    developerStats: (developerId: string) => ['reviews', 'developer-stats', developerId] as const,
    detail: (id: string) => ['reviews', 'detail', id] as const,
  },
  goals: {
    dashboard: (filters?: Record<string, unknown>) => ['goals', 'dashboard', filters] as const,
    all: (filters?: Record<string, unknown>) => ['goals', 'all', filters] as const,
    detail: (id: string) => ['goals', 'detail', id] as const,
    progress: (id: string) => ['goals', 'progress', id] as const,
    okrSummary: (id: string) => ['goals', 'okr-summary', id] as const,
    templates: ['goals', 'templates'] as const,
    achievements: (page?: number, limit?: number) => ['goals', 'achievements', page ?? 1, limit ?? 20] as const,
    history: (filters?: Record<string, unknown>) => ['goals', 'history', filters] as const,
    snapshots: (filters?: Record<string, unknown>) => ['goals', 'snapshots', filters] as const,
    achievementRate: (query?: Record<string, unknown>) => ['goals', 'achievement-rate', query] as const,
    teamComparison: (query?: Record<string, unknown>) => ['goals', 'team-comparison', query] as const,
    reportHistory: (query?: Record<string, unknown>) => ['goals', 'report-history', query] as const,
    reportsHistory: (filters?: Record<string, unknown>) => ['goals', 'reports-history', filters] as const,
    templateDetail: (id: string) => ['goals', 'templates', id] as const,
  },
  commits: {
    all: (filters?: Record<string, unknown>) => ['commits', 'all', filters] as const,
    stats: (query?: Record<string, unknown>) => ['commits', 'stats', query] as const,
    heatmap: (query?: Record<string, unknown>) => ['commits', 'heatmap', query] as const,
    detail: (id: string) => ['commits', 'detail', id] as const,
  },
  coverage: {
    all: (filters?: Record<string, unknown>) => ['coverage', 'all', filters] as const,
    detail: (id: string) => ['coverage', 'detail', id] as const,
    latest: (repositoryId: string) => ['coverage', 'latest', repositoryId] as const,
    trends: (repositoryId: string, query?: Record<string, unknown>) => ['coverage', 'trends', repositoryId, query] as const,
  },
  debt: {
    all: (filters?: Record<string, unknown>) => ['debt', 'all', filters] as const,
    hotspots: (repositoryId?: string) => ['debt', 'hotspots', repositoryId ?? ''] as const,
    trends: (query?: Record<string, unknown>) => ['debt', 'trends', query] as const,
    recommendations: (query?: Record<string, unknown>) => ['debt', 'recommendations', query] as const,
    attribution: ['debt', 'attribution'] as const,
    modules: (query?: Record<string, unknown>) => ['debt', 'modules', query] as const,
    detail: (id: string) => ['debt', 'detail', id] as const,
  },
  alerts: {
    all: (filters?: Record<string, unknown>) => ['alerts', 'all', filters] as const,
    detail: (id: string) => ['alerts', 'detail', id] as const,
    preferences: ['alerts', 'preferences'] as const,
    thresholds: ['alerts', 'thresholds'] as const,
    thresholdDetail: (alertType: string) => ['alerts', 'thresholds', alertType] as const,
  },
  notifications: {
    all: (filters?: Record<string, unknown>) => ['notifications', 'all', filters] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
    detail: (id: string) => ['notifications', 'detail', id] as const,
  },
  reports: {
    all: (filters?: Record<string, unknown>) => ['reports', 'all', filters] as const,
    detail: (id: string) => ['reports', 'detail', id] as const,
  },
  leaderboard: {
    developers: (query?: Record<string, unknown>) => ['leaderboard', 'developers', query] as const,
    teams: (query?: Record<string, unknown>) => ['leaderboard', 'teams', query] as const,
  },
  scores: {
    me: ['scores', 'me'] as const,
    dqs: (developerId: string) => ['scores', 'dqs', developerId] as const,
    dqsHistory: (developerId: string, query?: Record<string, unknown>) => ['scores', 'dqs-history', developerId, query] as const,
    dqsExplanation: (developerId: string) => ['scores', 'dqs-explanation', developerId] as const,
    sqs: (projectId: string) => ['scores', 'sqs', projectId] as const,
    sqsHistory: (projectId: string, query?: Record<string, unknown>) => ['scores', 'sqs-history', projectId, query] as const,
    riskyModules: (projectId: string) => ['scores', 'risky-modules', projectId] as const,
  },
  github: {
    status: ['github', 'status'] as const,
    repositories: ['github', 'repositories'] as const,
    webhookLogs: (query?: Record<string, unknown>) => ['github', 'webhook-logs', query] as const,
    webhookHealth: (period?: string) => ['github', 'webhook-health', period ?? '7d'] as const,
    backfillStatus: (repositoryId: string) => ['github', 'backfill-status', repositoryId] as const,
  },
  onboarding: {
    all: (query?: Record<string, unknown>) => ['onboarding', 'all', query] as const,
    detail: (id: string) => ['onboarding', 'detail', id] as const,
    dashboardStats: ['onboarding', 'dashboard-stats'] as const,
    atRiskDevelopers: ['onboarding', 'at-risk'] as const,
    velocity: (query?: Record<string, unknown>) => ['onboarding', 'velocity', query] as const,
    developerVelocity: (userId: string) => ['onboarding', 'velocity', userId] as const,
    templates: ['onboarding', 'templates'] as const,
    templateDetail: (id: string) => ['onboarding', 'templates', id] as const,
    developerProgress: (userId: string) => ['onboarding', 'progress', userId] as const,
    milestoneTimeline: (userId: string) => ['onboarding', 'timeline', userId] as const,
    availableMentors: ['onboarding', 'mentors'] as const,
    mentorCapacity: (mentorId: string) => ['onboarding', 'mentor-capacity', mentorId] as const,
    checklist: (id: string) => ['onboarding', 'checklist', id] as const,
  },
  organizations: {
    all: ['organizations', 'all'] as const,
    detail: (id: string) => ['organizations', 'detail', id] as const,
    members: (id: string) => ['organizations', 'members', id] as const,
    invitations: ['organizations', 'invitations'] as const,
    invitationDetail: (token: string) => ['organizations', 'invitations', token] as const,
  },
  members: {
    all: (organizationId?: string) => ['members', 'all', organizationId ?? ''] as const,
  },
  emailAliases: {
    all: ['email-aliases', 'all'] as const,
  },
  unmappedEmails: {
    all: ['unmapped-emails', 'all'] as const,
  },
  repositories: {
    all: (organizationId?: string) => ['repositories', 'all', organizationId ?? ''] as const,
  },
  audit: {
    logs: (filters?: Record<string, unknown>) => ['audit-logs', 'logs', filters] as const,
    detail: (id: string) => ['audit-logs', 'detail', id] as const,
    actionCounts: (query?: Record<string, unknown>) => ['audit-logs', 'action-counts', query] as const,
    activeUsers: (query?: Record<string, unknown>) => ['audit-logs', 'active-users', query] as const,
    failedPermissions: (query?: Record<string, unknown>) => ['audit-logs', 'failed-permissions', query] as const,
    timeline: (query?: Record<string, unknown>) => ['audit-logs', 'timeline', query] as const,
    topResources: (query?: Record<string, unknown>) => ['audit-logs', 'top-resources', query] as const,
    retentionPolicy: ['audit-logs', 'retention-policy'] as const,
    exportStatus: (id: string) => ['audit-logs', 'export', id] as const,
    gdprDataAccess: (userId: string) => ['audit-logs', 'gdpr', userId] as const,
  },
} as const;