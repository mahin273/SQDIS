import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  FiBell,
  FiCheck,
  FiChevronDown,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUser,
  FiX,
} from 'react-icons/fi'

type Organization = {
  id: string
  name: string
}

type DashboardUser = {
  name: string
  email?: string
}

type DashboardNavbarProps = {
  organizations?: Organization[]
  currentOrganizationId?: string
  user?: DashboardUser
  notificationCount?: number
  onCreateOrganization?: () => void
  onLogout?: () => void
}

type DashboardNotification = {
  id: string
  title: string
  message: string
  timeLabel: string
  read: boolean
}

function useOnClickOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return

      const clickedInsideSomeRef = refs.some((ref) => {
        const el = ref.current
        return el ? el.contains(target) : false
      })

      if (!clickedInsideSomeRef) onOutside()
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [enabled, onOutside, refs])
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function DashboardNavbar({
  organizations = [
    { id: 'org-1', name: 'Default Organization' },
    { id: 'org-2', name: 'SQDIS Demo Org' },
  ],
  currentOrganizationId = 'org-1',
  user = { name: 'Demo User', email: 'demo@sqdis.app' },
  notificationCount = 3,
  onCreateOrganization,
  onLogout,
}: DashboardNavbarProps) {
  const [orgOpen, setOrgOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const [notifications, setNotifications] = useState<DashboardNotification[]>(() => [
    {
      id: 'n-1',
      title: 'New alert detected',
      message: 'A repository triggered a new quality alert.',
      timeLabel: 'Just now',
      read: false,
    },
    {
      id: 'n-2',
      title: 'Weekly report ready',
      message: 'Your weekly code quality report is available.',
      timeLabel: '2h ago',
      read: false,
    },
    {
      id: 'n-3',
      title: 'Integration connected',
      message: 'GitHub integration connected successfully.',
      timeLabel: 'Yesterday',
      read: true,
    },
  ])

  const orgRef = useRef<HTMLDivElement | null>(null)
  const profileRef = useRef<HTMLDivElement | null>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  const currentOrg =
    organizations.find((o) => o.id === currentOrganizationId) ?? organizations[0]

  useOnClickOutside(
    [orgRef],
    () => setOrgOpen(false),
    orgOpen,
  )

  useOnClickOutside(
    [profileRef],
    () => setProfileOpen(false),
    profileOpen,
  )

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Search */}
        <div className="relative flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>

        {/* Organization dropdown */}
        <div ref={orgRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setOrgOpen((v) => !v)
              setProfileOpen(false)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            aria-haspopup="menu"
            aria-expanded={orgOpen}
          >
            <span className="max-w-[12rem] truncate">{currentOrg?.name}</span>
            <FiChevronDown className="text-gray-500" />
          </button>

          {orgOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Organizations
              </div>
              <div className="max-h-64 overflow-auto">
                {organizations.map((org) => {
                  const active = org.id === currentOrg?.id
                  return (
                    <button
                      key={org.id}
                      type="button"
                      className={
                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ' +
                        (active ? 'bg-gray-50 font-semibold text-gray-900' : 'text-gray-700')
                      }
                      onClick={() => setOrgOpen(false)}
                      role="menuitem"
                    >
                      <span className="truncate">{org.name}</span>
                      {active ? (
                        <span className="text-xs text-gray-500">Current</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="border-t border-gray-200">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setOrgOpen(false)
                    onCreateOrganization?.()
                  }}
                  role="menuitem"
                >
                  <FiPlus />
                  Open / create new organization
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          aria-label="Notifications"
          aria-haspopup="dialog"
          aria-expanded={notificationsOpen}
          onClick={() => {
            setNotificationsOpen((v) => !v)
            setOrgOpen(false)
            setProfileOpen(false)
          }}
        >
          <FiBell />
          {(unreadCount || notificationCount) > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-semibold text-white">
              {(unreadCount || notificationCount) > 99 ? '99+' : (unreadCount || notificationCount)}
            </span>
          ) : null}
        </button>

        {/* Notifications drawer */}
        {notificationsOpen ? (
          <div className="fixed inset-0 z-40">
            <button
              type="button"
              aria-label="Close notifications"
              className="absolute inset-0 bg-gray-900/20"
              onClick={() => setNotificationsOpen(false)}
            />

            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Notifications panel"
              className="absolute right-0 top-0 h-full w-full max-w-md border-l border-gray-200 bg-white shadow-sm"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      Notifications
                    </div>
                    <div className="text-xs text-gray-500">
                      {unreadCount} unread
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={markAllAsRead}
                      disabled={unreadCount === 0}
                    >
                      <FiCheck />
                      Mark all as read
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      aria-label="Close"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <FiX />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-3">
                  <div className="space-y-2">
                    {notifications.map((n) => {
                      const tone = n.read
                        ? 'bg-white text-gray-700'
                        : 'bg-gray-50 text-gray-900'

                      return (
                        <div
                          key={n.id}
                          className={
                            'rounded-lg border border-gray-200 p-3 ' +
                            tone
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {!n.read ? (
                                  <span className="inline-flex h-2 w-2 flex-none rounded-full bg-gray-900" />
                                ) : (
                                  <span className="inline-flex h-2 w-2 flex-none rounded-full bg-gray-300" />
                                )}
                                <div className="truncate text-sm font-semibold">
                                  {n.title}
                                </div>
                              </div>
                              <div className="mt-1 text-sm text-gray-600">
                                {n.message}
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                {n.timeLabel}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((v) => !v)
              setOrgOpen(false)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
              {getInitials(user.name)}
            </span>
            <span className="hidden max-w-[10rem] truncate sm:inline">{user.name}</span>
            <FiChevronDown className="text-gray-500" />
          </button>

          {profileOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                    {getInitials(user.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {user.name}
                    </div>
                    {user.email ? (
                      <div className="truncate text-xs text-gray-500">{user.email}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  role="menuitem"
                >
                  <FiUser />
                  Profile
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  role="menuitem"
                >
                  <FiSettings />
                  Settings
                </button>
              </div>

              <div className="border-t border-gray-200">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setProfileOpen(false)
                    onLogout?.()
                  }}
                  role="menuitem"
                >
                  <FiLogOut />
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
