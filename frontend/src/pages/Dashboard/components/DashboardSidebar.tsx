import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiBookOpen,
  FiBriefcase,
  FiCheckCircle,
  FiClipboard,
  FiFileText,
  FiFlag,
  FiGithub,
  FiGrid,
  FiLayers,
  FiLink,
  FiSettings,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi'
import { GiChart } from 'react-icons/gi'

const baseLink =
  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors'

const inactiveLink = 'text-gray-700 hover:bg-gray-100'
const activeLink = 'bg-gray-100 text-gray-900'

function SidebarItem({
  to,
  icon,
  label,
  end,
}: {
  to: string
  icon: ReactNode
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [baseLink, isActive ? activeLink : inactiveLink].join(' ')
      }
    >
      <span className="text-gray-500">{icon}</span>
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

function SidebarGroup({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <details className="group">
      <summary className={[baseLink, inactiveLink, 'cursor-pointer list-none'].join(' ')}>
        <span className="text-gray-500">{icon}</span>
        <span className="truncate">{label}</span>
        <span className="ml-auto text-xs text-gray-400 group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-1 space-y-1 pl-10">{children}</div>
    </details>
  )
}

export default function DashboardSidebar() {
  return (
    <aside className="hidden w-72 flex-none border-r border-gray-200 bg-white lg:block">
      <div className="flex h-screen flex-col">
        {/* Brand */}
        <div className="border-b border-gray-200 px-4 py-4">
          <NavLink to="/dashboard" className="flex items-center gap-3" end>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white">
              <GiChart className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">
                SQDIS
              </div>
              <div className="truncate text-xs text-gray-500">Code Intelligence</div>
            </div>
          </NavLink>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1">
            <SidebarItem to="/dashboard" icon={<FiGrid />} label="Dashboard" end />

            <SidebarGroup icon={<FiUsers />} label="Users & Teams">
              <SidebarItem
                to="/dashboard/org-members"
                icon={<FiUsers />}
                label="Organization Members"
              />
              <SidebarItem to="/dashboard/teams" icon={<FiLayers />} label="Teams" />
              <SidebarItem
                to="/dashboard/onboarding"
                icon={<FiZap />}
                label="Onboarding"
              />
            </SidebarGroup>

            <SidebarItem
              to="/dashboard/repositories"
              icon={<FiBriefcase />}
              label="Repositories"
            />
            <SidebarItem to="/dashboard/projects" icon={<FiTarget />} label="Projects" />

            <SidebarGroup icon={<FiTrendingUp />} label="Quality Metrics">
              <SidebarItem
                to="/dashboard/quality/dqs"
                icon={<FiCheckCircle />}
                label="DQS Scores"
              />
              <SidebarItem
                to="/dashboard/quality/sqs"
                icon={<FiTrendingUp />}
                label="SQS Scores"
              />
              <SidebarItem
                to="/dashboard/quality/coverage"
                icon={<FiClipboard />}
                label="Code Coverage"
              />
            </SidebarGroup>

            <SidebarItem to="/dashboard/alerts" icon={<FiAlertTriangle />} label="Alerts" />
            <SidebarItem to="/dashboard/reports" icon={<FiFileText />} label="Reports" />
            <SidebarItem
              to="/dashboard/sprints"
              icon={<FiFlag />}
              label="Sprints & Releases"
            />
            <SidebarItem to="/dashboard/goals" icon={<FiTarget />} label="Goals & OKRs" />
            <SidebarItem
              to="/dashboard/technical-debt"
              icon={<FiBookOpen />}
              label="Technical Debt"
            />

            <SidebarGroup icon={<FiLink />} label="Integrations">
              <SidebarItem
                to="/dashboard/integrations/github"
                icon={<FiGithub />}
                label="GitHub"
              />
            </SidebarGroup>

            <SidebarItem
              to="/dashboard/audit-logs"
              icon={<FiShield />}
              label="Audit Logs"
            />
            <SidebarItem
              to="/dashboard/settings"
              icon={<FiSettings />}
              label="Settings"
            />
          </div>
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-200 px-3 py-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Logged in workspace
          </div>
        </div>
      </div>
    </aside>
  )
}
