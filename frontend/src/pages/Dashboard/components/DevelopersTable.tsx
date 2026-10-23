import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiAward, FiUser } from 'react-icons/fi'
import MetricTable from './MetricTable'
import { dashboardService } from '@/services'
import { useUserRole } from '@/rbac/hooks'

function scoreTone(score: number) {
  if (score > 70) return { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
  if (score >= 50) return { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' }
  return { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' }
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
  const navigate = useNavigate()
  const userRole = useUserRole()
  const { data: developers = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'top-developers'],
    queryFn: () => dashboardService.getTopDevelopers(5),
  })

  const tableTitle = userRole === 'DEVELOPER'
    ? 'My Individual Quality & DQS'
    : userRole === 'TEAM_LEAD'
    ? 'Team Members by DQS'
    : 'Top Developers by DQS'

  return (
    <MetricTable
      title={tableTitle}
      icon={<FiAward />}
      onAction={() => navigate(userRole === 'DEVELOPER' ? '/scores' : '/developers')}
    >
      {isLoading ? (
        <div className="py-6 text-center text-sm text-slate-500">Loading developers...</div>
      ) : developers.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700 dark:text-slate-300">No developers with DQS yet</p>
          <p className="mt-1 text-xs text-slate-400">Scores are computed as commits and reviews are ingested.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 text-left">Developer</th>
                <th className="py-3 text-right">DQS</th>
                <th className="py-3 text-right">Commits</th>
                <th className="py-3 text-left">Team</th>
              </tr>
            </thead>
            <tbody>
              {developers.map((d) => {
                const tone = scoreTone(d.dqs || 0)
                return (
                  <tr
                    key={d.id}
                    className="cursor-pointer border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    onClick={() => navigate(`/developers/${d.id}`)}
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {d.avatarUrl ? (
                          <img
                            src={d.avatarUrl}
                            alt={d.name}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                            {initials(d.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {d.name}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                            <FiUser className="h-3 w-3" />
                            {d.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className={`text-sm font-bold ${tone.text}`}>
                          {d.dqs > 0 ? d.dqs.toFixed(1) : 'N/A'}
                        </span>
                        {d.dqs > 0 && <span className={`h-2 w-2 rounded-full ${tone.dot}`} />}
                      </div>
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formatNumber(d.commitCount || 0)}
                    </td>
                    <td className="py-3 text-sm text-slate-600 dark:text-slate-400">
                      {d.teamName || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </MetricTable>
  )
}
