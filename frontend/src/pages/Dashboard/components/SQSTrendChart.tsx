import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiTrendingUp } from 'react-icons/fi'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import MetricChart from './MetricChart'
import { dashboardService } from '@/services'

export default function SQSTrendChart() {
  const [days, setDays] = useState(30)

  const { data: trendData = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'sqs-trend', days],
    queryFn: () => dashboardService.getSQSTrend(days),
  })

  const chartData = trendData.map((item) => ({
    date: item.date.slice(5),
    value: item.value,
  }))

  return (
    <MetricChart
      title={`Software Quality Score Trend (Last ${days} Days)`}
      icon={<FiTrendingUp />}
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
          Loading SQS trend...
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700 dark:text-slate-300">No SQS scores calculated yet</p>
          <p className="text-xs text-slate-400">Quality scores are generated automatically as projects and commits are analyzed.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 4, right: 10, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              width={36}
            />
            <Tooltip
              formatter={(value) => {
                const v = typeof value === 'number' ? value.toFixed(1) : String(value)
                return [v, 'Avg SQS']
              }}
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '8px', border: '1px solid #334155', color: '#fff' }}
              labelStyle={{ color: '#f8fafc', fontWeight: 600, marginBottom: '4px' }}
              itemStyle={{ color: '#818cf8', fontWeight: 500 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </MetricChart>
  )
}
