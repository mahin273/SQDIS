import { useEffect, useMemo } from 'react'
import {
  FiAlertTriangle,
  FiBell,
  FiClipboard,
  FiFlag,
  FiTarget,
  FiTool,
} from 'react-icons/fi'
import MetricTable from './MetricTable'
import { useApi } from '../../../hooks/useApi'
import { auditLogsApi } from '../../../services'
import type { AuditLog } from '../../../types/api.types'

type ActivityType = 'commit' | 'alert' | 'sprint' | 'goal'

type ActivityItem = {
  id: string
  type: ActivityType
  title: string
  subtitle: string
  meta: string
}

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

function toActivityItem(log: AuditLog): ActivityItem {
  const actor = log.user?.name || 'Someone'
  const when = log.timestamp ? timeAgo(log.timestamp) : ''
  const severity = log.severity ? ` • ${log.severity}` : ''
  const meta = [when, severity.replace(' • ', '')].filter(Boolean).join(' • ') || '—'
  const isAlert = log.severity === 'HIGH' || log.severity === 'CRITICAL'
  const type: ActivityType = isAlert ? 'alert' : 'commit'
  const title = `${actor} ${log.action} ${log.resourceType}`
  const subtitle = log.resourceId ? `Resource: ${log.resourceId}` : '—'
  return { id: log.id, type, title, subtitle, meta }
}

function iconFor(type: ActivityType) {
  if (type === 'commit') return <FiTool />
  if (type === 'alert') return <FiAlertTriangle />
  if (type === 'sprint') return <FiFlag />
  return <FiTarget />
}

export default function ActivityFeed() {
  const { data, loading, error, call } = useApi(auditLogsApi.getAll)

  useEffect(() => {
    void call({ page: 1, pageSize: 5 })
  }, [call])

  const items = useMemo<ActivityItem[]>(() => {
    if (!data?.data) return []
    return data.data.slice(0, 5).map(toActivityItem)
  }, [data])

  return (
    <MetricTable
      title="Recent Activity"
      icon={<FiClipboard />}
      onAction={() => {
        // placeholder for navigation
      }}
    >
      {loading ? (
        <div className="py-6 text-sm text-gray-600">Loading activity…</div>
      ) : error ? (
        <div className="py-6 text-sm text-gray-600">Unable to load activity.</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-sm text-gray-600">No recent activity yet.</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {items.map((item) => (
            <div key={item.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gray-50 text-gray-700">
                  {iconFor(item.type)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                  <div className="mt-1 text-sm text-gray-700">{item.subtitle}</div>
                  <div className="mt-2 text-xs text-gray-500">{item.meta}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-500">
        <FiBell />
        Real-time updates will appear here.
      </div>
    </MetricTable>
  )
}
