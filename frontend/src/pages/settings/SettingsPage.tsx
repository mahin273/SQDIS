import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Building, Github, GitBranch, Users, Mail, User, 
  Bell, HelpCircle, ShieldCheck, Search, ChevronRight
} from 'lucide-react'
import { OrganizationSettings } from './OrganizationSettings'
import { GitHubSettingsPage } from './GitHubSettingsPage'
import { RepositoriesPage } from './RepositoriesPage'
import { MembersPage } from './MembersPage'
import { InvitationsPage } from './InvitationsPage'
import { EmailAliasesPage } from './EmailAliasesPage'
import { UnmappedEmailsPage } from './UnmappedEmailsPage'
import { ProfileSettings } from './ProfileSettings'
import { NotificationSettings } from './NotificationSettings'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useAuthStore } from '@/stores/authStore'

export type SettingsTab =
  | 'profile'
  | 'organization'
  | 'github'
  | 'repositories'
  | 'members'
  | 'invitations'
  | 'email-aliases'
  | 'unmapped-emails'
  | 'notifications'

interface NavTabItem {
  id: SettingsTab
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavCategory {
  id: string
  title: string
  items: NavTabItem[]
}

const CATEGORIES: NavCategory[] = [
  {
    id: 'account',
    title: 'Account & Security',
    items: [
      {
        id: 'profile',
        label: 'Profile & Security',
        description: 'Personal details, display name, and password credentials.',
        icon: User,
      },
      {
        id: 'notifications',
        label: 'Notification Channels',
        description: 'In-app alerts, email notifications, Slack webhooks, and quiet hours.',
        icon: Bell,
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace & Governance',
    items: [
      {
        id: 'organization',
        label: 'Organization Profile',
        description: 'Workspace identity, slug routing, and resource quotas.',
        icon: Building,
      },
      {
        id: 'members',
        label: 'Access Governance',
        description: 'Member directory, RBAC roles, and developer permissions.',
        icon: Users,
      },
      {
        id: 'invitations',
        label: 'Team Invitations',
        description: 'Pending member invites and onboarding invitations.',
        icon: Mail,
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Code & Integrations',
    items: [
      {
        id: 'github',
        label: 'GitHub App & OAuth',
        description: '1-click OAuth integration, PAT tokens, and webhook logs.',
        icon: Github,
      },
      {
        id: 'repositories',
        label: 'Repository Tracking',
        description: 'Enabled codebases, sync cadence, and SQS quality gates.',
        icon: GitBranch,
      },
      {
        id: 'email-aliases',
        label: 'Git Author Identities',
        description: 'Map alternate commit author emails to your user account.',
        icon: ShieldCheck,
      },
      {
        id: 'unmapped-emails',
        label: 'Unmapped Git Commits',
        description: 'Unassigned repository commit emails needing developer attribution.',
        icon: HelpCircle,
      },
    ],
  },
]

const ALL_TABS: SettingsTab[] = [
  'profile',
  'organization',
  'github',
  'repositories',
  'members',
  'invitations',
  'email-aliases',
  'unmapped-emails',
  'notifications',
]

export function SettingsPage({ initialTab = 'profile' }: { initialTab?: SettingsTab }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentOrganization } = useOrganizationStore()
  const { user } = useAuthStore()

  // Determine active tab from URL query param "?tab=..." or fallback to initialTab prop
  const tabFromUrl = searchParams.get('tab') as SettingsTab | null
  const currentTab: SettingsTab = useMemo(() => {
    if (tabFromUrl && ALL_TABS.includes(tabFromUrl)) {
      return tabFromUrl
    }
    if (ALL_TABS.includes(initialTab)) {
      return initialTab
    }
    return 'profile'
  }, [tabFromUrl, initialTab])

  const [activeTab, setActiveTab] = useState<SettingsTab>(currentTab)
  const [searchQuery, setSearchQuery] = useState('')

  // Sync state if URL search param or initialTab prop changes
  useEffect(() => {
    if (currentTab !== activeTab) {
      setActiveTab(currentTab)
    }
  }, [currentTab])

  // Change tab handler updates URL query param seamlessly
  const handleTabChange = (tabId: SettingsTab) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId }, { replace: true })
  }

  // Find active category and item metadata for breadcrumbs
  const activeMeta = useMemo(() => {
    for (const cat of CATEGORIES) {
      const match = cat.items.find((i) => i.id === activeTab)
      if (match) {
        return { category: cat.title, item: match }
      }
    }
    return { category: 'Account & Security', item: CATEGORIES[0].items[0] }
  }, [activeTab])

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return CATEGORIES

    return CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0)
  }, [searchQuery])

  return (
    <div className="space-y-6">
      
      {/* Enterprise Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <span>Settings</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span>{activeMeta.category}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{activeMeta.item.label}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Settings & Administration
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {activeMeta.item.description}
          </p>
        </div>

        {/* Workspace & Role Context Pill */}
        <div className="flex items-center gap-3">
          {currentOrganization && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
              <Building className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">{currentOrganization.name}</span>
              {user?.role && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 uppercase">
                  {user.role}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Settings Grid Layout */}
      <div className="grid gap-8 lg:grid-cols-4">
        
        {/* Left Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Quick Settings Search Filter */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Filter settings..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs bg-white dark:bg-slate-900 h-8"
            />
          </div>

          {/* Categorized Nav Sections */}
          <nav className="space-y-6">
            {filteredCategories.map((category) => (
              <div key={category.id} className="space-y-1.5">
                <h3 className="px-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {category.title}
                </h3>
                <div className="space-y-1">
                  {category.items.map((item) => {
                    const Icon = item.icon
                    const isSelected = activeTab === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id)}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all text-left ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold shadow-xs border border-blue-200/60 dark:border-blue-800/50'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isSelected && (
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="p-4 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                No matching settings found for "{searchQuery}".
              </div>
            )}
          </nav>
        </div>

        {/* Right Active Content Panel */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'organization' && <OrganizationSettings />}
          {activeTab === 'github' && <GitHubSettingsPage />}
          {activeTab === 'repositories' && <RepositoriesPage />}
          {activeTab === 'members' && <MembersPage />}
          {activeTab === 'invitations' && <InvitationsPage />}
          {activeTab === 'email-aliases' && <EmailAliasesPage />}
          {activeTab === 'unmapped-emails' && <UnmappedEmailsPage />}
          {activeTab === 'notifications' && <NotificationSettings />}
        </div>

      </div>

    </div>
  )
}
