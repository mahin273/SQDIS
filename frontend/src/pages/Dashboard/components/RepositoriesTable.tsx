import { useMemo, useState } from 'react'
import { FiBox, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import MetricTable from './MetricTable'

type RepoRow = {
  name: string
  sqs: number
  coverage: number
  commits: number
  lastUpdated: string
}

type SortKey = keyof Pick<RepoRow, 'name' | 'sqs' | 'coverage' | 'commits' | 'lastUpdated'>
type SortDir = 'asc' | 'desc'

function scoreTone(score: number) {
  if (score > 70) return { dot: 'bg-green-600', text: 'text-green-700' }
  if (score >= 50) return { dot: 'bg-yellow-500', text: 'text-yellow-700' }
  return { dot: 'bg-red-600', text: 'text-red-700' }
}

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n)
}

function sortValue(row: RepoRow, key: SortKey) {
  return row[key]
}

export default function RepositoriesTable() {
  const rows = useMemo<RepoRow[]>(
    () => [
      { name: 'frontend-app', sqs: 92.5, coverage: 88.2, commits: 1234, lastUpdated: '2 hours ago' },
      { name: 'backend-api', sqs: 87.3, coverage: 82.5, commits: 2456, lastUpdated: '5 hours ago' },
      { name: 'mobile-app', sqs: 78.9, coverage: 75.3, commits: 987, lastUpdated: '1 day ago' },
      { name: 'data-pipeline', sqs: 72.1, coverage: 68.9, commits: 543, lastUpdated: '3 days ago' },
      { name: 'auth-service', sqs: 68.5, coverage: 65.2, commits: 321, lastUpdated: '1 week ago' },
    ],
    [],
  )

  const [sortKey, setSortKey] = useState<SortKey>('sqs')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const next = [...rows]
    next.sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)

      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }

      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return next
  }, [rows, sortDir, sortKey])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('desc')
  }

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return null
    return sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />
  }

  const headerButton = (key: SortKey, label: string, alignRight?: boolean) => (
    <button
      type="button"
      className={
        'inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 ' +
        (alignRight ? 'justify-end' : '')
      }
      onClick={() => toggleSort(key)}
    >
      {label}
      <span className="text-gray-400" aria-hidden="true">
        {sortIcon(key)}
      </span>
    </button>
  )

  return (
    <MetricTable
      title="Top Repositories by SQS"
      icon={<FiBox />}
      onAction={() => {
        // placeholder for navigation
      }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 text-left">{headerButton('name', 'Repository')}</th>
              <th className="py-3 text-right">{headerButton('sqs', 'SQS', true)}</th>
              <th className="py-3 text-right">{headerButton('coverage', 'Coverage', true)}</th>
              <th className="py-3 text-right">{headerButton('commits', 'Commits', true)}</th>
              <th className="py-3 text-right">{headerButton('lastUpdated', 'Last Updated', true)}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const tone = scoreTone(r.sqs)
              return (
                <tr
                  key={r.name}
                  className="cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  onClick={() => {
                    // placeholder: navigate to repo details
                  }}
                >
                  <td className="py-3 pr-4">
                    <div className="text-sm font-semibold text-gray-900">{r.name}</div>
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
                    {formatNumber(r.commits)}
                  </td>
                  <td className="py-3 text-right text-sm text-gray-600">{r.lastUpdated}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </MetricTable>
  )
}
