import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import { dashboardService } from '@/services'

function toneForScore(score: number) {
  if (score > 70) return '#10b981' // emerald-500
  if (score >= 50) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

export default function TeamPerformanceChart() {
  const navigate = useNavigate()
  const { data = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'top-teams'],
    queryFn: () => dashboardService.getTopTeams(5),
  })

  return (
    <MetricChart
      title="Team Performance (Avg DQS)"
      icon={<FiUsers />}
      footer={
        <div className="px-5 py-4">
          <button
            type="button"
            className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => navigate('/teams')}
          >
            View All Teams →
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Loading team performance...
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700 dark:text-slate-300">No teams created yet</p>
          <p className="text-xs text-slate-400">Organize developers into teams to benchmark team-level quality.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 24, right: 24, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis domain={[0, 100]} type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="#94a3b8" />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="#94a3b8"
            />
            <Tooltip
              cursor={false}
              formatter={(value) => {
                const v = typeof value === 'number' ? value.toFixed(1) : String(value)
                return [v, 'Avg DQS']
              }}
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '8px', border: '1px solid #334155', color: '#fff' }}
              labelStyle={{ color: '#f8fafc', fontWeight: 600, marginBottom: '4px' }}
              itemStyle={{ color: '#34d399', fontWeight: 500 }}
            />
            <Bar dataKey="avgDqs" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={36}>
              {data.map((entry) => (
                <Cell key={entry.id} fill={toneForScore(entry.avgDqs || 0)} />
              ))}
              <LabelList
                dataKey="avgDqs"
                position="right"
                formatter={(value) => {
                  if (typeof value === 'number') return value.toFixed(1)
                  return '0'
                }}
                style={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MetricChart>
  )
}
