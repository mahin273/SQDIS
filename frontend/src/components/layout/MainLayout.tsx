import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function MainLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-row font-sans">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
