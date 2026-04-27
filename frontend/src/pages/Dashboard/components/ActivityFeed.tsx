import { useMemo } from 'react'
import {
  FiAlertTriangle,
  FiBell,
  FiClipboard,
  FiFlag,
  FiTarget,
  FiTool,
} from 'react-icons/fi'
import MetricTable from './MetricTable'

type ActivityType = 'commit' | 'alert' | 'sprint' | 'goal'

type ActivityItem = {
  id: string
  type: ActivityType
  title: string
  subtitle: string
  meta: string
}

function iconFor(type: ActivityType) {
  if (type === 'commit') return <FiTool />
  if (type === 'alert') return <FiAlertTriangle />
  if (type === 'sprint') return <FiFlag />
  return <FiTarget />
}

export default function ActivityFeed() {
  const items = useMemo<ActivityItem[]>(
    () => [
      {
        id: 'a-1',
        type: 'commit',
        title: 'Alice Johnson committed to frontend-app',
        subtitle: '“feat: Add user authentication flow”',
        meta: '2 hours ago • Feature',
      },
      {
        id: 'a-2',
        type: 'commit',
        title: 'Bob Smith committed to backend-api',
        subtitle: '“fix: Resolve database connection timeout”',
        meta: '3 hours ago • Bugfix',
      },
      {
        id: 'a-3',
        type: 'alert',
        title: 'New alert: High anomaly detected in data-pipeline',
        subtitle: 'Anomaly score: 0.87 • Critical',
        meta: '5 hours ago',
      },
      {
        id: 'a-4',
        type: 'sprint',
        title: 'Sprint “Q1 2026 Sprint 3” completed',
        subtitle: 'Frontend Team • 45 commits • 12 features',
        meta: '1 day ago',
      },
    ],
    [],
  )

  return (
    <MetricTable
      title="Recent Activity"
      icon={<FiClipboard />}
      onAction={() => {
        // placeholder for navigation
      }}
    >
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

      <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-500">
        <FiBell />
        Real-time updates will appear here.
      </div>
    </MetricTable>
  )
}
