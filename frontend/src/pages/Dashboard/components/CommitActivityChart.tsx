import { useMemo } from 'react'
import { FiCode } from 'react-icons/fi'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import MetricChart from './MetricChart'

type CommitPoint = {
  day: string
  Feature: number
  Bugfix: number
  Refactor: number
  Test: number
  Docs: number
}

function makeCommitData(days: number): CommitPoint[] {
  const labels = Array.from({ length: days }, (_, i) => i)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return labels.map((i) => {
    const base = 35 + (i % 7) * 6
    const weekend = i % 7 >= 5
    const multiplier = weekend ? 0.55 : 1

    const Feature = Math.max(0, Math.round((base * 0.45 + (i % 5) * 2) * multiplier))
    const Bugfix = Math.max(0, Math.round((base * 0.22 + (i % 3) * 2) * multiplier))
    const Refactor = Math.max(0, Math.round((base * 0.18 + (i % 4)) * multiplier))
    const Test = Math.max(0, Math.round((base * 0.1 + (i % 2)) * multiplier))
    const Docs = Math.max(0, Math.round((base * 0.05 + (i % 6 === 0 ? 3 : 0)) * multiplier))

    return {
      day: dayNames[i % 7],
      Feature,
      Bugfix,
      Refactor,
      Test,
      Docs,
    }
  })
}

export default function CommitActivityChart() {
  const data = useMemo(() => makeCommitData(30), [])

  return (
    <MetricChart title="Commit Activity (Last 30 Days)" icon={<FiCode />}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 10, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={36} />
          <Tooltip />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="square"
          />

          <Bar dataKey="Feature" stackId="a" fill="#111827" />
          <Bar dataKey="Bugfix" stackId="a" fill="#374151" />
          <Bar dataKey="Refactor" stackId="a" fill="#6B7280" />
          <Bar dataKey="Test" stackId="a" fill="#9CA3AF" />
          <Bar dataKey="Docs" stackId="a" fill="#D1D5DB" />
        </BarChart>
      </ResponsiveContainer>
    </MetricChart>
  )
}
