import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { NotificationBell } from '@/components/common/NotificationBell'
import { Avatar } from '@/components/ui/avatar'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/dropdown'
import { Menu, Sun, Moon, LogOut, User as UserIcon, Settings, Building2, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'

export function Header() {
  const { toggleSidebar, theme, setTheme } = useUIStore()
  const { user, logout } = useAuthStore()
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganizationStore()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 sm:px-6 backdrop-blur-md transition-colors">
      {/* Left side: Mobile menu button & Org Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 focus:outline-none"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Organization Switcher Dropdown */}
        {organizations && organizations.length > 0 && (
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="max-w-[140px] sm:max-w-[200px] truncate">
                  {currentOrganization?.name || 'Select Organization'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            }
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Organizations
            </div>
            {organizations.map((org) => (
              <DropdownItem
                key={org.id}
                onClick={() => setCurrentOrganization(org)}
                className={currentOrganization?.id === org.id ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{org.name}</span>
                  {org.role && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {org.role}
                    </Badge>
                  )}
                </div>
              </DropdownItem>
            ))}
          </Dropdown>
        )}
      </div>

      {/* Right side: Notifications, Theme, Profile */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Profile Dropdown */}
        <Dropdown
          align="right"
          trigger={
            <button className="flex items-center gap-2 rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none">
              <Avatar name={user?.name || user?.email || 'User'} size="sm" />
            </button>
          }
        >
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          </div>
          <DropdownItem icon={<UserIcon className="h-4 w-4" />} onClick={() => navigate('/settings/profile')}>
            Profile Settings
          </DropdownItem>
          <DropdownItem icon={<Settings className="h-4 w-4" />} onClick={() => navigate('/settings')}>
            Account Settings
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem icon={<LogOut className="h-4 w-4" />} danger onClick={() => logout()}>
            Log out
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  )
}
