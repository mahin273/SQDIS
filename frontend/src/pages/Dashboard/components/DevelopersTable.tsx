import { useMemo, useState } from 'react'
import { FiAward, FiChevronDown, FiChevronUp, FiUser } from 'react-icons/fi'
import MetricTable from './MetricTable'

type DevRow = {
  name: string
  dqs: number
  commits: number
  team: string
  lastActive: string
}

type SortKey = keyof Pick<DevRow, 'name' | 'dqs' | 'commits' | 'team' | 'lastActive'>
type SortDir = 'asc' | 'desc'

function scoreTone(score: number) {
  if (score > 70) return { dot: 'bg-green-600', text: 'text-green-700' }
  if (score >= 50) return { dot: 'bg-yellow-500', text: 'text-yellow-700' }
  return { dot: 'bg-red-600', text: 'text-red-700' }
}

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n)
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function DevelopersTable() {
  const rows = useMemo<DevRow[]>(
    () => [
      { name: 'Alice Johnson', dqs: 94.2, commits: 456, team: 'Frontend', lastActive: '1 hour ago' },
      { name: 'Bob Smith', dqs: 89.7, commits: 523, team: 'Backend', lastActive: '3 hours ago' },
      { name: 'Carol White', dqs: 85.3, commits: 389, team: 'DevOps', lastActive: '5 hours ago' },
      { name: 'David Brown', dqs: 82.1, commits: 412, team: 'Mobile', lastActive: '1 day ago' },
      { name: 'Eve Davis', dqs: 78.9, commits: 345, team: 'QA', lastActive: '2 days ago' },
    ],
    [],
  )

  const [sortKey, setSortKey] = useState<SortKey>('dqs')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const next = [...rows]
    next.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
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
      title="Top Developers by DQS"
      icon={<FiAward />}
      onAction={() => {
        // placeholder for navigation
      }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 text-left">{headerButton('name', 'Developer')}</th>
              <th className="py-3 text-right">{headerButton('dqs', 'DQS', true)}</th>
              <th className="py-3 text-right">{headerButton('commits', 'Commits', true)}</th>
              <th className="py-3 text-left">{headerButton('team', 'Team')}</th>
              <th className="py-3 text-right">{headerButton('lastActive', 'Last Active', true)}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
              const tone = scoreTone(d.dqs)
              return (
                <tr
                  key={d.name}
                  className="cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  onClick={() => {
                    // placeholder: navigate to developer details
                  }}
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                        {initials(d.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">
                          {d.name}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <FiUser />
                          Member
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <span className={"text-sm font-semibold " + tone.text}>
                        {d.dqs.toFixed(1)}
                      </span>
                      <span className={"h-2 w-2 rounded-full " + tone.dot} aria-hidden="true" />
                    </div>
                  </td>
                  <td className="py-3 text-right text-sm font-medium text-gray-700">
                    {formatNumber(d.commits)}
                  </td>
                  <td className="py-3 text-sm font-medium text-gray-700">{d.team}</td>
                  <td className="py-3 text-right text-sm text-gray-600">{d.lastActive}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </MetricTable>
  )
}
