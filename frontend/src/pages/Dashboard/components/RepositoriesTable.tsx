import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiBox } from 'react-icons/fi'
import MetricTable from './MetricTable'
import { dashboardService } from '@/services'

function scoreTone(score: number) {
  if (score > 70) return { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
  if (score >= 50) return { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' }
  return { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' }
}

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n)
}

export default function RepositoriesTable() {
  const navigate = useNavigate()
  const { data: repositories = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'top-repositories'],
    queryFn: () => dashboardService.getTopRepositories(5),
  })

  return (
    <MetricTable
      title="Top Repositories by SQS"
      icon={<FiBox />}
      onAction={() => navigate('/projects')}
    >
      {isLoading ? (
        <div className="py-6 text-center text-sm text-slate-500">Loading repositories...</div>
      ) : repositories.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700 dark:text-slate-300">No repositories connected yet</p>
          <p className="mt-1 text-xs text-slate-400">Connect a GitHub repository in Settings to start tracking code quality.</p>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="mt-3 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Connect Repository
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 text-left">Repository</th>
                <th className="py-3 text-right">SQS</th>
                <th className="py-3 text-right">Coverage</th>
                <th className="py-3 text-right">Commits</th>
              </tr>
            </thead>
            <tbody>
              {repositories.map((r) => {
                const tone = scoreTone(r.sqs || 0)
                const cov = r.coverage ?? 0
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    onClick={() => navigate('/projects')}
                  >
                    <td className="py-3 pr-4">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.name}</div>
                      {r.fullName && (
                        <div className="text-xs text-slate-400 truncate">{r.fullName}</div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className={`text-sm font-bold ${tone.text}`}>
                          {(r.sqs || 0) > 0 ? r.sqs.toFixed(1) : 'N/A'}
                        </span>
                        {(r.sqs || 0) > 0 && <span className={`h-2 w-2 rounded-full ${tone.dot}`} />}
                      </div>
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                      {cov > 0 ? `${cov.toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formatNumber(r.commitCount ?? r.commits ?? 0)}
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
