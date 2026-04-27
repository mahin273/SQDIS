import { dashboardStyles } from './Dashboard.styles'
import DashboardNavbar from './components/DashboardNavbar'
import DashboardSidebar from './components/DashboardSidebar'

export default function Dashboard() {
  return (
    <div className={dashboardStyles.shell}>
      <DashboardSidebar />

      <div className={dashboardStyles.content}>
        <DashboardNavbar
          notificationCount={3}
          user={{ name: 'Demo User', email: 'demo@sqdis.app' }}
        />

        <main className={dashboardStyles.page}>
          <header className={dashboardStyles.header}>
            <h1 className={dashboardStyles.title}>Dashboard</h1>
            <p className={dashboardStyles.subtitle}>
              (Placeholder) Wire these sidebar items to real pages next.
            </p>
          </header>

          <div className={dashboardStyles.grid}>{/* Dashboard components will go here */}</div>
        </main>
      </div>
    </div>
  )
}
