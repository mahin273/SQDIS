import { useEffect, useMemo } from 'react'
import { dashboardStyles } from './Dashboard.styles'
import { useApi } from '../../hooks/useApi'
import { authApi, auditLogsApi } from '../../services'
import DashboardNavbar from './components/DashboardNavbar'
import DashboardSidebar from './components/DashboardSidebar'
import MetricCard from './components/MetricCard'
import CommitActivityChart from './components/CommitActivityChart'
import SQSTrendChart from './components/SQSTrendChart'
import TeamPerformanceChart from './components/TeamPerformanceChart'
import RepositoriesTable from './components/RepositoriesTable'
import RepositoriesNeedingAttentionTable from './components/RepositoriesNeedingAttentionTable'
import DevelopersTable from './components/DevelopersTable'
import ActivityFeed from './components/ActivityFeed'
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiCode,
  FiCrosshair,
  FiUsers,
} from 'react-icons/fi'

function sumCounts<T extends { count: number }>(items: T[] | null | undefined) {
  return items?.reduce((total, item) => total + item.count, 0) ?? 0
}

export default function Dashboard() {
  const { data: profile, call: loadProfile } = useApi(authApi.getProfile)
  const { data: orgData, call: loadOrganizations } = useApi(authApi.getOrganizations)
  const { data: auditLogData, call: loadAuditLogs } = useApi(auditLogsApi.getAll)
  const { data: activeUsersData, call: loadActiveUsers } = useApi(auditLogsApi.getActiveUsers)
  const { data: failedPermissionsData, call: loadFailedPermissions } = useApi(auditLogsApi.getFailedPermissions)
  const { data: actionCountsData, call: loadActionCounts } = useApi(auditLogsApi.getActionCounts)
  const { data: highLogsData, call: loadHighLogs } = useApi(auditLogsApi.getAll)
  const { data: criticalLogsData, call: loadCriticalLogs } = useApi(auditLogsApi.getAll)

  useEffect(() => {
    void loadProfile()
    void loadOrganizations()
  }, [loadOrganizations, loadProfile])

  const organizations = orgData ?? []
  const currentOrgId = profile?.organizationId ?? organizations[0]?.id ?? ''

  useEffect(() => {
    if (!currentOrgId) return

    void Promise.all([
      loadAuditLogs({ page: 1, pageSize: 1 }),
      loadActiveUsers({ limit: 100 }),
      loadFailedPermissions({}),
      loadActionCounts({}),
      loadHighLogs({ page: 1, pageSize: 1, severity: 'HIGH' }),
      loadCriticalLogs({ page: 1, pageSize: 1, severity: 'CRITICAL' }),
    ])
  }, [currentOrgId, loadActionCounts, loadActiveUsers, loadAuditLogs, loadCriticalLogs, loadFailedPermissions, loadHighLogs])

  const handleSelectOrganization = async (orgId: string) => {
    await authApi.switchOrganization(orgId)
    void loadProfile()
    void loadOrganizations()
  }

  const dashboardUser = useMemo(
    () => ({
      name: profile?.name ?? 'Signed-in user',
      email: profile?.email ?? 'Connected account',
    }),
    [profile],
  )

  const metrics = useMemo(
    () => ({
      organizations: organizations.length,
      activeUsers: activeUsersData?.length ?? 0,
      auditEvents: auditLogData?.total ?? 0,
      criticalEvents: (highLogsData?.total ?? 0) + (criticalLogsData?.total ?? 0),
      failedPermissions: sumCounts(failedPermissionsData),
      actionVolume: sumCounts(actionCountsData),
    }),
    [activeUsersData, actionCountsData, auditLogData?.total, failedPermissionsData, highLogsData?.total, criticalLogsData?.total, organizations.length],
  )

  return (
    <div className={dashboardStyles.shell}>
      <DashboardSidebar />

      <div className={dashboardStyles.content}>
        <DashboardNavbar
          notificationCount={metrics.criticalEvents}
          user={dashboardUser}
          organizations={organizations}
          currentOrganizationId={currentOrgId}
          onSelectOrganization={handleSelectOrganization}
        />

        <div className="flex-1 overflow-y-auto">
          <main className={dashboardStyles.page}>
            <header className={dashboardStyles.header}>
              <h1 className={dashboardStyles.title}>Dashboard</h1>
              <p className={dashboardStyles.subtitle}>
                Organization-wide software quality overview
              </p>
            </header>

            <section className={dashboardStyles.grid}>
              <div className="lg:col-span-12">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <MetricCard
                    title="Organizations"
                    icon={<FiBriefcase />}
                    value={metrics.organizations.toString()}
                    trend={{ direction: 'up', label: 'Connected from auth API' }}
                  />
                  <MetricCard
                    title="Active Users"
                    icon={<FiUsers />}
                    value={metrics.activeUsers.toString()}
                    trend={{ direction: 'up', label: 'From audit analytics' }}
                  />
                  <MetricCard
                    title="Audit Events"
                    icon={<FiBarChart2 />}
                    value={metrics.auditEvents.toString()}
                    trend={{ direction: 'up', label: 'Current organization total' }}
                  />
                  <MetricCard
                    title="Critical Events"
                    icon={<FiCrosshair />}
                    value={metrics.criticalEvents.toString()}
                    trend={{ direction: 'down', label: 'HIGH + CRITICAL logs' }}
                  />
                  <MetricCard
                    title="Failed Permissions"
                    icon={<FiCode />}
                    value={metrics.failedPermissions.toString()}
                    trend={{ direction: 'up', label: 'Audit analytics total' }}
                  />
                  <MetricCard
                    title="Action Volume"
                    icon={<FiAlertTriangle />}
                    value={metrics.actionVolume.toString()}
                    secondary="From audit action counts"
                  />
                </div>
              </div>

              <div className="lg:col-span-6">
                <SQSTrendChart />
              </div>
              <div className="lg:col-span-6">
                <CommitActivityChart />
              </div>
              <div className="lg:col-span-12">
                <TeamPerformanceChart />
              </div>

              <div className="lg:col-span-12">
                <RepositoriesTable />
              </div>

              <div className="lg:col-span-12">
                <RepositoriesNeedingAttentionTable />
              </div>

              <div className="lg:col-span-12">
                <DevelopersTable />
              </div>

              <div className="lg:col-span-12">
                <ActivityFeed />
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
