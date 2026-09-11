import React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useAuthStore } from '@/stores/authStore'
import { useFilteredNavigation, type NavItemConfig } from '@/rbac'
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  Trophy,
  Code2,
  Bell,
  CheckSquare,
  FileSpreadsheet,
  AlertTriangle,
  Flame,
  UserPlus,
  ShieldCheck,
  LineChart,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  Moon,
  Sun,
  GitCommit,
  FileCode,
  GitPullRequest,
  Timer,
  Rocket,
  BrainCircuit,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Logo, LogoIcon } from '@/components/ui/Logo'

const MAIN_NAV_LABELS = [
  'Dashboard',
  'Quality Scores',
  'Code Intelligence',
  'Projects',
  'Teams',
  'Developers',
  'Leaderboard',
  'Commits',
  'Coverage',
  'Reviews',
  'Sprints',
  'Releases',
  'Goals',
  'Tech Debt',
  'Alerts',
]

const SECONDARY_NAV_LABELS = [
  'Reports',
  'Organization Members',
  'Onboarding',
  'Audit Logs',
  'Audit Analytics',
  'Real-Time Monitor',
]

const iconMap: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="h-5 w-5" />,
  'Quality Scores': <LineChart className="h-5 w-5" />,
  'Code Intelligence': <BrainCircuit className="h-5 w-5" />,
  Developers: <Code2 className="h-5 w-5" />,
  Leaderboard: <Trophy className="h-5 w-5" />,
  Commits: <GitCommit className="h-5 w-5" />,
  Coverage: <FileCode className="h-5 w-5" />,
  Notifications: <Bell className="h-5 w-5" />,
  Reviews: <GitPullRequest className="h-5 w-5" />,
  Goals: <CheckSquare className="h-5 w-5" />,
  Reports: <FileSpreadsheet className="h-5 w-5" />,
  Teams: <Users className="h-5 w-5" />,
  Projects: <FolderGit2 className="h-5 w-5" />,
  Sprints: <Timer className="h-5 w-5" />,
  Alerts: <AlertTriangle className="h-5 w-5" />,
  'Tech Debt': <Flame className="h-5 w-5" />,
  Releases: <Rocket className="h-5 w-5" />,
  'Organization Members': <Users className="h-5 w-5" />,
  Onboarding: <UserPlus className="h-5 w-5" />,
  'Audit Logs': <ShieldCheck className="h-5 w-5" />,
  'Audit Analytics': <LineChart className="h-5 w-5" />,
  'Real-Time Monitor': <Activity className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
}

function NavItemComponent({ item, collapsed }: { item: NavItemConfig; collapsed: boolean }) {
  const icon = iconMap[item.label] || <LayoutDashboard className="h-5 w-5" />

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors select-none',
          isActive
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200',
          collapsed && 'justify-center px-2'
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

export function Sidebar() {
  const navItems = useFilteredNavigation()
  const { sidebarCollapsed, setSidebarCollapsed, theme, setTheme } = useUIStore()
  const { currentOrganization } = useOrganizationStore()
  const { user, logout } = useAuthStore()

  const mainNav = navItems.filter((item) => MAIN_NAV_LABELS.includes(item.label))
  const secondaryNav = navItems.filter((item) => SECONDARY_NAV_LABELS.includes(item.label))
  const settingsNav = navItems.filter((item) => item.label === 'Settings')

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 select-none shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4 shrink-0">
        {!sidebarCollapsed ? (
          <Logo size="md" />
        ) : (
          <div className="mx-auto flex items-center justify-center">
            <LogoIcon size={32} />
          </div>
        )}

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            'rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors',
            sidebarCollapsed && 'hidden'
          )}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Organization Badge / Selector */}
      {currentOrganization && !sidebarCollapsed && (
        <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 border border-slate-200/60 dark:border-slate-700/50">
            <Building2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {currentOrganization.name}
              </p>
              {currentOrganization.role && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium">
                  {currentOrganization.role}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Main Nav */}
        <div className="space-y-1">
          {!sidebarCollapsed && (
            <p className="px-3 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2">
              Main Menu
            </p>
          )}
          {mainNav.map((item) => (
            <NavItemComponent key={item.path} item={item} collapsed={sidebarCollapsed} />
          ))}
        </div>

        {/* Operations Nav */}
        {secondaryNav.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {!sidebarCollapsed && (
              <p className="px-3 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2">
                Operations
              </p>
            )}
            {secondaryNav.map((item) => (
              <NavItemComponent key={item.path} item={item} collapsed={sidebarCollapsed} />
            ))}
          </div>
        )}

        {/* Settings */}
        {settingsNav.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {settingsNav.map((item) => (
              <NavItemComponent key={item.path} item={item} collapsed={sidebarCollapsed} />
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Footer (User & Controls) */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-3">
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Avatar name={user?.name || user?.email || ''} size="sm" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Avatar name={user?.name || user?.email || ''} size="sm" />
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user?.name || 'User'}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  {user?.email}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={() => logout()}
                className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400"
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
