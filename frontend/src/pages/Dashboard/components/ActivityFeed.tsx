import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FiAlertTriangle,
  FiBell,
  FiClipboard,
  FiGitCommit,
  FiCode,
  FiTag,
  FiCheckCircle,
} from 'react-icons/fi'
import MetricTable from './MetricTable'
import { Pagination } from '@/components/ui/pagination'
import { dashboardService } from '@/services'
import type { RecentActivity } from '@/types'

function timeAgo(iso: string) {
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function iconFor(type: string) {
  if (type === 'commit' || type === 'COMMIT') return <FiGitCommit className="text-blue-500" />
  if (type === 'alert' || type === 'ALERT') return <FiAlertTriangle className="text-rose-500" />
  if (type === 'debt' || type === 'DEBT') return <FiCode className="text-purple-500" />
  if (type === 'release' || type === 'RELEASE') return <FiTag className="text-emerald-500" />
  return <FiCheckCircle className="text-slate-500" />
}

function getClassificationColor(cls?: string) {
  switch (cls?.toUpperCase()) {
    case 'FEATURE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    case 'BUG_FIX':
    case 'FIX':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
    case 'REFACTOR':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    case 'DOCS':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

function getSeverityColor(sev?: string) {
  switch (sev?.toUpperCase()) {
    case 'CRITICAL':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
    case 'HIGH':
      return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
    case 'WARNING':
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

type TabType = 'all' | 'commit' | 'alert' | 'debt' | 'release'

export interface ActivityFeedProps {
  onItemClick?: (item: RecentActivity) => void
}

export default function ActivityFeed({ onItemClick }: ActivityFeedProps = {}) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [page, setPage] = useState<number>(1)
  const pageSize = 10

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setPage(1)
  }

  const { data: activityResponse, isLoading } = useQuery({
    queryKey: ['dashboard', 'recent-activity', activeTab, page, pageSize],
    queryFn: () =>
      dashboardService.getRecentActivity({
        page,
        limit: pageSize,
        type: activeTab === 'all' ? undefined : activeTab,
      }),
  })

  const items = activityResponse?.data ?? []
  const totalItems = activityResponse?.total ?? 0
  const totalPages = activityResponse?.totalPages ?? 1

  const counts: Record<TabType, number> = {
    all: activityResponse?.counts?.all ?? totalItems,
    commit: activityResponse?.counts?.commit ?? 0,
    alert: activityResponse?.counts?.alert ?? 0,
    debt: activityResponse?.counts?.debt ?? 0,
    release: activityResponse?.counts?.release ?? 0,
  }

  const handleRowClick = (item: RecentActivity) => {
    if (onItemClick) {
      onItemClick(item)
      return
    }
    const t = item.type?.toLowerCase()
    if (t === 'commit') navigate('/commits')
    else if (t === 'alert') navigate('/alerts')
    else if (t === 'debt') navigate('/debt')
    else if (t === 'release') navigate('/releases')
  }

  return (
    <MetricTable
      title="Recent Activity"
      icon={<FiClipboard />}
      actionLabel="View All"
      onAction={() => navigate('/commits')}
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
        {(['all', 'commit', 'alert', 'debt', 'release'] as TabType[]).map((tab) => {
          if (tab !== 'all' && counts[tab] === 0 && activeTab !== tab) return null
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {tab === 'all'
                ? 'All'
                : tab === 'commit'
                ? 'Commits'
                : tab === 'alert'
                ? 'Alerts'
                : tab === 'debt'
                ? 'Debt'
                : 'Releases'}{' '}
              ({counts[tab]})
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-slate-500">Loading activity...</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700 dark:text-slate-300">No recent activity</p>
          <p className="mt-1 text-xs text-slate-400">Events, commits, and quality alerts will appear here in real-time.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {items.map((item: RecentActivity) => {
            const headline = item.title || item.message || item.description || 'Activity update'
            const repo = item.repositoryName || item.repository
            const author = item.author || item.user?.name
            const meta = item.metadata

            return (
              <div
                key={item.id}
                onClick={() => handleRowClick(item)}
                className="group -mx-2 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer first:pt-2 last:pb-2"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-sm">
                    {iconFor(item.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                        {headline}
                      </span>

                      {meta?.classification && (
                        <span
                          className={`rounded border px-1.5 py-0.2 text-[10px] font-semibold ${getClassificationColor(
                            meta.classification
                          )}`}
                        >
                          {meta.classification}
                        </span>
                      )}

                      {meta?.severity && (
                        <span
                          className={`rounded border px-1.5 py-0.2 text-[10px] font-semibold ${getSeverityColor(
                            meta.severity
                          )}`}
                        >
                          {meta.severity}
                        </span>
                      )}

                      {meta?.markerType && (
                        <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                          {meta.markerType}
                        </span>
                      )}

                      {meta?.shortSha && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          #{meta.shortSha}
                        </span>
                      )}

                      {meta?.anomalyFlag && (
                        <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[10px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                          ANOMALY
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                      {item.timestamp && <span>{timeAgo(item.timestamp)}</span>}
                      {author && <span>by {author}</span>}
                      {repo && (
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {repo}
                        </span>
                      )}
                      {(meta?.linesAdded !== undefined || meta?.linesDeleted !== undefined) && (
                        <span className="font-mono text-[10px]">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{meta?.linesAdded ?? 0}
                          </span>{' '}
                          <span className="text-rose-600 dark:text-rose-400">
                            -{meta?.linesDeleted ?? 0}
                          </span>
                          {meta?.filesChanged !== undefined && (
                            <span className="text-slate-400"> in {meta.filesChanged} files</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          compact
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={(newPage) => setPage(newPage)}
          className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"
        />
      )}

      <div className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500">
        <FiBell className="text-blue-500" />
        Real-time GitHub webhooks will stream updates automatically.
      </div>
    </MetricTable>
  )
}
