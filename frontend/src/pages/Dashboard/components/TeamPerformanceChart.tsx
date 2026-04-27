import { useMemo } from 'react'
import { FiUsers } from 'react-icons/fi'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import MetricChart from './MetricChart'

type TeamPoint = {
  name: string
  dqs: number
}

function toneForScore(score: number) {
  if (score > 70) return '#15803D' // green-700
  if (score >= 50) return '#A16207' // yellow-700
  return '#B91C1C' // red-700
}

export default function TeamPerformanceChart() {
  const data = useMemo<TeamPoint[]>(
    () => [
      { name: 'Frontend Team', dqs: 85.2 },
      { name: 'Backend Team', dqs: 78.5 },
      { name: 'DevOps Team', dqs: 72.3 },
      { name: 'Mobile Team', dqs: 68.9 },
      { name: 'QA Team', dqs: 65.4 },
    ],
    [],
  )

  return (
    <MetricChart
      title="Team Performance (Avg DQS)"
      icon={<FiUsers />}
      footer={
        <div className="px-5 py-4">
          <button
            type="button"
            className="text-sm font-semibold text-gray-900 hover:underline"
          >
            View All Teams →
          </button>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 24, right: 16, top: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis domain={[0, 100]} type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => {
              const v = typeof value === 'number' ? value.toFixed(1) : String(value)
              return [v, 'Avg DQS']
            }}
          />
          <Bar dataKey="dqs" radius={[8, 8, 8, 8]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={toneForScore(entry.dqs)} />
            ))}
            <LabelList
              dataKey="dqs"
              position="right"
              formatter={(value) => {
                if (typeof value === 'number') return value.toFixed(1)
                if (typeof value === 'string') return value
                return ''
              }}
              style={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </MetricChart>
  )
}
