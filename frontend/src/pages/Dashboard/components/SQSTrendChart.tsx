import { useMemo, useState } from 'react'
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

type Point = {
  day: string
  value: number
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function makeTrendData(days: number): Point[] {
  const points: Point[] = []
  let v = 62

  for (let i = 1; i <= days; i++) {
    const wave = Math.sin(i / 6) * 2
    const drift = (i / days) * 18
    const noise = (i % 5 === 0 ? -1.5 : 1.1)
    v = clamp(v + wave + drift / days + noise * 0.25, 40, 92)

    points.push({
      day: `Day ${i}`,
      value: Number(v.toFixed(1)),
    })
  }

  return points
}

export default function SQSTrendChart() {
  const [days, setDays] = useState(30)

  const data = useMemo(() => makeTrendData(days), [days])

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
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 4, right: 10, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12 }}
            interval={Math.ceil(days / 6)}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            width={36}
          />
          <Tooltip
            formatter={(value) => {
              const v = typeof value === 'number' ? value.toFixed(1) : String(value)
              return [v, 'Avg SQS']
            }}
            labelFormatter={(label) => label}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#111827"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </MetricChart>
  )
}
