import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts'
import { formatNumber } from '@/lib/utils'

interface ShapAttributionChartProps {
  shapValues: Record<string, number>
}

export function ShapAttributionChart({ shapValues }: ShapAttributionChartProps) {
  const data = useMemo(() => {
    return Object.entries(shapValues)
      .map(([feature, value]) => ({
        feature: feature.replace(/_/g, ' '),
        value,
      }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  }, [shapValues])

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
        No SHAP attribution data available.
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { feature, value } = payload[0].payload
      const isPositive = value >= 0
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <p className="font-medium text-slate-900 dark:text-slate-100 mb-1">{feature}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Impact:</span>
            <span className={`font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isPositive ? '+' : ''}{value.toFixed(2)}
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} className="stroke-slate-200 dark:stroke-slate-800" opacity={0.5} />
          <XAxis 
            type="number" 
            className="text-xs text-slate-500" 
            tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}`}
          />
          <YAxis 
            dataKey="feature" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            width={120}
            className="text-xs text-slate-600 dark:text-slate-400 font-medium"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          <ReferenceLine x={0} stroke="#94a3b8" />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
