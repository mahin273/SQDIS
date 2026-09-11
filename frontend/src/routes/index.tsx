import { lazy, Suspense } from 'react'
import { useRoutes, Navigate, type RouteObject } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'
import { AuthLayout, MainLayout } from '@/components/layout'
import { PageLoader } from '@/components/common/PageLoader'

// Lazy loaded page components
const LandingPage = lazy(() => import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const AcceptInvitationPage = lazy(() => import('@/pages/auth/AcceptInvitationPage').then((m) => ({ default: m.AcceptInvitationPage })))
const OAuthCallbackPage = lazy(() => import('@/pages/auth/OAuthCallbackPage').then((m) => ({ default: m.OAuthCallbackPage })))

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const CommitsPage = lazy(() => import('@/pages/commits/CommitsPage').then((m) => ({ default: m.CommitsPage })))
const CoveragePage = lazy(() => import('@/pages/coverage/CoveragePage').then((m) => ({ default: m.CoveragePage })))
const DevelopersPage = lazy(() => import('@/pages/developers/DevelopersPage').then((m) => ({ default: m.DevelopersPage })))
const DeveloperProfilePage = lazy(() => import('@/pages/developers/DeveloperProfilePage').then((m) => ({ default: m.DeveloperProfilePage })))
const TeamsPage = lazy(() => import('@/pages/teams/TeamsPage').then((m) => ({ default: m.TeamsPage })))
const TeamDetailPage = lazy(() => import('@/pages/teams/TeamDetailPage').then((m) => ({ default: m.TeamDetailPage })))
const ProjectsPage = lazy(() => import('@/pages/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const ProjectDetailPage = lazy(() => import('@/pages/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })))
const SprintsPage = lazy(() => import('@/pages/sprints/SprintsPage').then((m) => ({ default: m.SprintsPage })))
const SprintDetailPage = lazy(() => import('@/pages/sprints/SprintDetailPage').then((m) => ({ default: m.SprintDetailPage })))
const ReleasesPage = lazy(() => import('@/pages/releases/ReleasesPage').then((m) => ({ default: m.ReleasesPage })))
const ReleaseDetailPage = lazy(() => import('@/pages/releases/ReleaseDetailPage').then((m) => ({ default: m.ReleaseDetailPage })))
const ReviewsPage = lazy(() => import('@/pages/reviews/ReviewsPage').then((m) => ({ default: m.ReviewsPage })))
const ReviewDebtPage = lazy(() => import('@/pages/reviews/ReviewDebtPage').then((m) => ({ default: m.ReviewDebtPage })))
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const DebtPage = lazy(() => import('@/pages/debt/DebtPage').then((m) => ({ default: m.DebtPage })))
const AlertsPage = lazy(() => import('@/pages/alerts/AlertsPage').then((m) => ({ default: m.AlertsPage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })))
const OrganizationSetupPage = lazy(() => import('@/pages/setup/OrganizationSetupPage').then((m) => ({ default: m.OrganizationSetupPage })))
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const AuditLogsPage = lazy(() => import('@/pages/audit').then((m) => ({ default: m.AuditLogsPage })))
const AuditAnalyticsPage = lazy(() => import('@/pages/audit').then((m) => ({ default: m.AuditAnalyticsPage })))
const RealTimeAuditMonitorPage = lazy(() => import('@/pages/audit').then((m) => ({ default: m.RealTimeAuditMonitorPage })))
const EmailVerificationPage = lazy(() => import('@/pages/auth/EmailVerificationPage').then((m) => ({ default: m.EmailVerificationPage })))
const ScoresPage = lazy(() => import('@/pages/scores/ScoresPage').then((m) => ({ default: m.ScoresPage })))
const OrgMembersPage = lazy(() => import('@/pages/members/OrgMembersPage').then((m) => ({ default: m.OrgMembersPage })))
const CodeIntelligencePage = lazy(() => import('@/pages/code-intelligence/CodeIntelligencePage').then((m) => ({ default: m.CodeIntelligencePage })))



const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <LandingPage />,
  },
  // Public auth routes
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/signin', element: <Navigate to="/login" replace /> },
          { path: '/signup', element: <Navigate to="/register" replace /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
          { path: '/invitations/:token', element: <AcceptInvitationPage /> },
          { path: '/verify-email/:token', element: <EmailVerificationPage /> },
          { path: '/email-aliases/verify/:token', element: <EmailVerificationPage /> },
        ],
      },
      { path: '/auth/callback', element: <OAuthCallbackPage /> },
    ],
  },
  // Protected application routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/setup/organization',
        element: <OrganizationSetupPage />,
      },
      {
        element: <MainLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/scores', element: <ScoresPage /> },
          { path: '/code-intelligence', element: <CodeIntelligencePage /> },
          { path: '/teams', element: <TeamsPage /> },
          { path: '/teams/:id', element: <TeamDetailPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/:id', element: <ProjectDetailPage /> },
          { path: '/sprints', element: <SprintsPage /> },
          { path: '/sprints/:id', element: <SprintDetailPage /> },
          { path: '/releases', element: <ReleasesPage /> },
          { path: '/releases/:id', element: <ReleaseDetailPage /> },
          { path: '/reviews', element: <ReviewsPage /> },
          { path: '/reviews/debt', element: <ReviewDebtPage /> },
          { path: '/goals', element: <GoalsPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/debt', element: <DebtPage /> },
          { path: '/alerts', element: <AlertsPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/settings/profile', element: <SettingsPage initialTab="profile" /> },
          { path: '/settings/organization', element: <SettingsPage initialTab="organization" /> },
          { path: '/settings/github', element: <SettingsPage initialTab="github" /> },
          { path: '/settings/repositories', element: <SettingsPage initialTab="repositories" /> },
          { path: '/settings/members', element: <SettingsPage initialTab="members" /> },
          { path: '/settings/invitations', element: <SettingsPage initialTab="invitations" /> },
          { path: '/settings/email-aliases', element: <SettingsPage initialTab="email-aliases" /> },
          { path: '/settings/unmapped-emails', element: <SettingsPage initialTab="unmapped-emails" /> },
          { path: '/settings/notifications', element: <SettingsPage initialTab="notifications" /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/commits', element: <CommitsPage /> },
          { path: '/coverage', element: <CoveragePage /> },
          { path: '/developers', element: <DevelopersPage /> },
          { path: '/developers/:id', element: <DeveloperProfilePage /> },
          { path: '/leaderboard', element: <LeaderboardPage /> },
          { path: '/onboarding', element: <OnboardingPage /> },
          { path: '/audit-logs', element: <AuditLogsPage /> },
          { path: '/audit-logs/analytics', element: <AuditAnalyticsPage /> },
          { path: '/audit-logs/monitor', element: <RealTimeAuditMonitorPage /> },
          { path: '/members', element: <OrgMembersPage /> },
          { path: '/organization/members', element: <OrgMembersPage /> },
          { path: '/dashboard/org-members', element: <OrgMembersPage /> },
          // Dashboard route redirects/aliases
          { path: '/dashboard/teams', element: <Navigate to="/teams" replace /> },
          { path: '/dashboard/onboarding', element: <Navigate to="/onboarding" replace /> },
          { path: '/dashboard/repositories', element: <Navigate to="/settings/repositories" replace /> },
          { path: '/dashboard/projects', element: <Navigate to="/projects" replace /> },
          { path: '/dashboard/quality/dqs', element: <Navigate to="/scores" replace /> },
          { path: '/dashboard/quality/sqs', element: <Navigate to="/scores" replace /> },
          { path: '/dashboard/quality/coverage', element: <Navigate to="/coverage" replace /> },
          { path: '/dashboard/alerts', element: <Navigate to="/alerts" replace /> },
          { path: '/dashboard/reports', element: <Navigate to="/reports" replace /> },
          { path: '/dashboard/sprints', element: <Navigate to="/sprints" replace /> },
          { path: '/dashboard/goals', element: <Navigate to="/goals" replace /> },
          { path: '/dashboard/technical-debt', element: <Navigate to="/debt" replace /> },
          { path: '/dashboard/integrations/github', element: <Navigate to="/settings/github" replace /> },
          { path: '/dashboard/audit-logs', element: <Navigate to="/audit-logs" replace /> },
          { path: '/dashboard/settings', element: <Navigate to="/settings" replace /> },
        ],
      },
    ],
  },
  // Fallbacks
  { path: '/forbidden', element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
]

export function AppRoutes() {
  const element = useRoutes(routes)
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>
}
