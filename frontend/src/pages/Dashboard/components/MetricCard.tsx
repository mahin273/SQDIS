type Props = {
  title: string
  value: string
  hint?: string
}

export default function MetricCard({ title, value, hint }: Props) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
      {hint ? <div className="mt-2 text-sm text-gray-600">{hint}</div> : null}
    </div>
  )
}
