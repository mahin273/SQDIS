import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitCommit, GitPullRequest, Search, Plus, GitBranch, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CommitChart, ChartSuspense } from '@/components/charts'
import { commitsService, repositoriesService } from '@/services'
import { codeIntelligenceService } from '@/services/codeIntelligence.service'
import type { CommitRiskItem } from '@/services/codeIntelligence.service'
import { queryKeys } from '@/lib/queryClient'
import { formatDate, formatNumber } from '@/lib/utils'
import { MetricTile, PageHeader, QueryState } from '../pageUtils'

import type { Commit } from '@/types'

export function CommitsPage() {
  const [search, setSearch] = useState('')
  const [expandedSha, setExpandedSha] = useState<string | null>(null)

  const commitsQuery = useQuery({
    queryKey: queryKeys.commits.all({ search }),
    queryFn: () => commitsService.getAll({ search: search || undefined, pageSize: 50 }),
  })
  const statsQuery = useQuery({
    queryKey: queryKeys.commits.stats(),
    queryFn: () => commitsService.getStats(),
  })

  const reposQuery = useQuery({
    queryKey: ['repositories'],
    queryFn: () => repositoriesService.getAll(),
  })

  const rawCommits = commitsQuery.data
  const commits: Commit[] = Array.isArray(rawCommits)
    ? rawCommits
    : (rawCommits && typeof rawCommits === 'object' && Array.isArray((rawCommits as any).data))
    ? (rawCommits as any).data
    : []

  const primaryRepoId = (reposQuery.data && Array.isArray(reposQuery.data) && reposQuery.data.length > 0)
    ? reposQuery.data[0].id
    : commits[0]?.repositoryId || ''

  const commitsRiskQuery = useQuery({
    queryKey: ['commits-risk', primaryRepoId],
    queryFn: () => codeIntelligenceService.getRepositoryCommitsRisk(primaryRepoId, 50),
    enabled: !!primaryRepoId,
  })

  const commitRiskMap = useMemo(() => {
    const map = new Map<string, CommitRiskItem>()
    ;(commitsRiskQuery.data || []).forEach((item) => {
      if (item.commitSha) map.set(item.commitSha, item)
    })
    return map
  }, [commitsRiskQuery.data])

  const chartData = useMemo(
    () =>
      commits.slice(0, 14).reverse().map((commit) => ({
        date: formatDate(commit.committedAt, { month: 'short', day: 'numeric' }),
        commits: 1,
        additions: commit.insertions,
        deletions: commit.deletions,
      })),
    [commits]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commits"
        description="Review commit volume, churn, and ML quality classifications across repositories."
        action={
          <Input
            className="w-64"
            placeholder="Search commits by message, SHA, author..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Total commits"
          value={formatNumber(statsQuery.data?.totalCommits ?? commits.length)}
          icon={<GitCommit className="h-5 w-5" />}
        />
        <MetricTile
          label="Insertions"
          value={formatNumber(statsQuery.data?.totalInsertions ?? 0)}
          icon={<GitPullRequest className="h-5 w-5 text-emerald-500" />}
        />
        <MetricTile
          label="Deletions"
          value={formatNumber(statsQuery.data?.totalDeletions ?? 0)}
          icon={<GitPullRequest className="h-5 w-5 text-rose-500" />}
        />
      </div>

      <QueryState isLoading={commitsQuery.isLoading} error={commitsQuery.error} onRetry={() => commitsQuery.refetch()}>
        {commits.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 mb-3">
                <GitBranch className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No commits found
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                {search
                  ? `No commits matched "${search}". Try clearing your search filter.`
                  : 'No commits have been ingested for your organization yet. Connect your GitHub repository in Settings to sync commits.'}
              </p>
              {!search && (
                <Link
                  to="/settings"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Connect Repository
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
              <Card>
                <CardContent className="p-5">
                  <ChartSuspense>
                    <CommitChart data={chartData} />
                  </ChartSuspense>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 p-5">
                  <p className="font-semibold text-slate-950 dark:text-white">Top authors</p>
                  {(statsQuery.data?.topAuthors ?? []).slice(0, 6).map((author) => (
                    <div key={author.authorId} className="flex items-center justify-between text-sm">
                      <span className="truncate text-slate-600 dark:text-slate-300">{author.name}</span>
                      <Badge variant="secondary">{author.count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardContent className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
                {commits.map((commit) => {
                  const risk = commitRiskMap.get(commit.sha)
                  const isExpanded = expandedSha === commit.sha

                  return (
                    <div key={commit.id} className="p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto_8rem_7rem] md:items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="truncate font-medium text-slate-950 dark:text-white">{commit.message}</p>
                            {risk && (
                              <button
                                type="button"
                                onClick={() => setExpandedSha(isExpanded ? null : commit.sha)}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border transition-colors cursor-pointer"
                                style={{
                                  backgroundColor:
                                    risk.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' :
                                    risk.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.12)' :
                                    risk.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.12)' :
                                    'rgba(16, 185, 129, 0.12)',
                                  color:
                                    risk.riskLevel === 'CRITICAL' ? '#ef4444' :
                                    risk.riskLevel === 'HIGH' ? '#f97316' :
                                    risk.riskLevel === 'MODERATE' ? '#d97706' :
                                    '#10b981',
                                  borderColor:
                                    risk.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' :
                                    risk.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.25)' :
                                    risk.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.25)' :
                                    'rgba(16, 185, 129, 0.25)',
                                }}
                                title="Click to toggle Kamei JIT defect risk drivers"
                              >
                                {risk.riskLevel === 'CRITICAL' || risk.riskLevel === 'HIGH' ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : (
                                  <ShieldCheck className="h-3 w-3" />
                                )}
                                JIT {(risk.defectProbability * 100).toFixed(0)}% {risk.riskLevel}
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {commit.authorName} · {commit.sha.slice(0, 7)} · {commit.branch}
                          </p>
                        </div>
                        <Badge variant="outline">{commit.classification}</Badge>
                        <span className="text-sm text-slate-500 dark:text-slate-400">{formatDate(commit.committedAt)}</span>
                        <span className="text-sm font-medium text-slate-950 dark:text-white">
                          +{commit.insertions} / -{commit.deletions}
                        </span>
                      </div>

                      {isExpanded && risk && (
                        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              Kamei JIT Commit Defect Analysis
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              SHA: {commit.sha}
                            </span>
                          </div>
                          {risk.topRiskDrivers && risk.topRiskDrivers.length > 0 ? (
                            <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                              {risk.topRiskDrivers.map((driver, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-amber-500 font-bold">•</span>
                                  <span>{driver}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-500">No critical defect risk patterns detected in this changeset.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  )
}
