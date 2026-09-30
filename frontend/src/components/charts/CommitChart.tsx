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
import { cn } from '@/lib/utils'

export interface CommitChartPoint {
  date: string
  additions?: number
  deletions?: number
  commits?: number
}

interface CommitChartProps {
  data: CommitChartPoint[]
  height?: number
  className?: string
}

export function CommitChart({ data, height = 300, className }: CommitChartProps) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
          <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
          <Tooltip cursor={false} contentStyle={{ borderRadius: 8, borderColor: '#cbd5e1' }} />
          <Legend />
          <Bar dataKey="commits" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Bar dataKey="additions" fill="#16a34a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="deletions" fill="#e11d48" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
