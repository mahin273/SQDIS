import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCode } from 'react-icons/fi'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import MetricChart from './MetricChart'
import { dashboardService } from '@/services'

export default function CommitActivityChart() {
  const [days, setDays] = useState(30)

  const { data: trendData = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'commit-trend', days],
    queryFn: () => dashboardService.getCommitTrend(days),
  })

  const chartData = trendData.map((item) => ({
    date: item.date.slice(5), // MM-DD
    commits: item.value,
  }))

  return (
    <MetricChart
      title={`Commit Activity (Last ${days} Days)`}
      icon={<FiCode />}
      rangeOptions={[
        { label: '7 Days', value: 7 },
        { label: '30 Days', value: 30 },
        { label: '90 Days', value: 90 },
      ]}
      selectedRange={days}
      onRangeChange={setDays}
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Loading commit trend...
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700 dark:text-slate-300">No commits recorded yet</p>
          <p className="text-xs text-slate-400">Push commits to your repository or configure GitHub webhooks to see real-time activity.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 4, right: 10, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
            <Tooltip
              cursor={false}
              formatter={(value) => [value, 'Commits']}
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', border: 'none', color: '#fff' }}
            />
            <Bar dataKey="commits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </MetricChart>
  )
}
