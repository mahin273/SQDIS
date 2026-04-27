import { useMemo } from 'react'
import { FiAlertTriangle } from 'react-icons/fi'
import MetricTable from './MetricTable'

type Row = {
  name: string
  sqs: number
  coverage: number
  issues: number
}

function scoreTone(score: number) {
  if (score > 70) return { dot: 'bg-green-600', text: 'text-green-700' }
  if (score >= 50) return { dot: 'bg-yellow-500', text: 'text-yellow-700' }
  return { dot: 'bg-red-600', text: 'text-red-700' }
}

export default function RepositoriesNeedingAttentionTable() {
  const rows = useMemo<Row[]>(
    () => [
      { name: 'legacy-system', sqs: 42.3, coverage: 35.2, issues: 12 },
      { name: 'old-api', sqs: 48.9, coverage: 42.8, issues: 8 },
      { name: 'prototype-v1', sqs: 51.2, coverage: 48.5, issues: 5 },
    ],
    [],
  )

  return (
    <MetricTable
      title="Repositories Needing Attention"
      icon={<FiAlertTriangle />}
      onAction={() => {
        // placeholder for navigation
      }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Repository
              </th>
              <th className="py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                SQS
              </th>
              <th className="py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Coverage
              </th>
              <th className="py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Issues
              </th>
              <th className="py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tone = scoreTone(r.sqs)
              return (
                <tr key={r.name} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-3 pr-4">
                    <div className="text-sm font-semibold text-gray-900">{r.name}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      SQS &lt; 60 or Coverage &lt; 50%
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <span className={"text-sm font-semibold " + tone.text}>
                        {r.sqs.toFixed(1)}
                      </span>
                      <span className={"h-2 w-2 rounded-full " + tone.dot} aria-hidden="true" />
                    </div>
                  </td>
                  <td className="py-3 text-right text-sm font-medium text-gray-700">
                    {r.coverage.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right text-sm font-medium text-gray-700">
                    {r.issues}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                      onClick={() => {
                        // placeholder: open review screen
                      }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </MetricTable>
  )
}
