import { dashboardStyles } from './Dashboard.styles'
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

export default function Dashboard() {
  return (
    <div className={dashboardStyles.shell}>
      <DashboardSidebar />

      <div className={dashboardStyles.content}>
        <DashboardNavbar
          notificationCount={3}
          user={{ name: 'Demo User', email: 'demo@sqdis.app' }}
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
                    title="Repositories"
                    icon={<FiBriefcase />}
                    value="24"
                    trend={{ direction: 'up', label: '3 this month' }}
                  />
                  <MetricCard
                    title="Developers"
                    icon={<FiUsers />}
                    value="156"
                    trend={{ direction: 'up', label: '12 this month' }}
                  />
                  <MetricCard
                    title="Avg SQS"
                    icon={<FiBarChart2 />}
                    value="78.5"
                    highlight="sqs"
                    trend={{ direction: 'up', label: '2.3 from last week' }}
                  />
                  <MetricCard
                    title="Avg Coverage"
                    icon={<FiCrosshair />}
                    value="82.3%"
                    trend={{ direction: 'up', label: '1.2% from last week' }}
                  />
                  <MetricCard
                    title="Total Commits"
                    icon={<FiCode />}
                    value="45,234"
                    trend={{ direction: 'up', label: '1,234 this week' }}
                  />
                  <MetricCard
                    title="Open Alerts"
                    icon={<FiAlertTriangle />}
                    value="12"
                    secondary="3 Critical"
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
