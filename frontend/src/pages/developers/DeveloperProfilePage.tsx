import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitCommit, ShieldCheck, TrendingUp, MessageSquare, Bug, Activity, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSuspense, TrendChart } from '@/components/charts'
import { developersService } from '@/services'
import { formatDate, formatNumber } from '@/lib/utils'
import { MetricTile, PageHeader, QueryState, formatScore } from '../pageUtils'

export function DeveloperProfilePage() {
  const { id = '' } = useParams()
  const developerQuery = useQuery({
    queryKey: ['developers', 'detail', id],
    queryFn: () => developersService.getById(id),
    enabled: !!id,
  })
  const statsQuery = useQuery({
    queryKey: ['developers', 'stats', id],
    queryFn: () => developersService.getStats(id),
    enabled: !!id,
  })

  const developer = developerQuery.data
  const stats = statsQuery.data

  const bugfixRatio = stats ? (stats.techDebtResolved / Math.max(1, stats.techDebtIntroduced + stats.techDebtResolved)) * 100 : 0
  const turnaroundStr = stats?.avgReviewTurnaround 
    ? (stats.avgReviewTurnaround > 60 ? `${(stats.avgReviewTurnaround/60).toFixed(1)}h` : `${stats.avgReviewTurnaround}m`) 
    : '0m'

  return (
    <div>
      <PageHeader
        title={developer?.name ?? stats?.name ?? 'Developer profile'}
        description={developer?.email ?? 'Developer score, commit, review, and coverage detail.'}
        action={developer?.status && <Badge variant={developer.status === 'ACTIVE' ? 'success' : 'secondary'}>{developer.status}</Badge>}
      />
      <QueryState
        isLoading={developerQuery.isLoading || statsQuery.isLoading}
        error={developerQuery.error || statsQuery.error}
        onRetry={() => {
          developerQuery.refetch()
          statsQuery.refetch()
        }}
      >
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <MetricTile label="DQS" value={formatScore(stats?.dqs ?? developer?.dqs)} icon={<TrendingUp className="h-5 w-5" />} />
          <MetricTile label="Commit Cadence" value={formatNumber(stats?.commits ?? 0)} icon={<GitCommit className="h-5 w-5" />} />
          <MetricTile label="Test Coverage of Touched Files" value={`${formatScore(stats?.codeCoverage)}%`} icon={<ShieldCheck className="h-5 w-5" />} />
          <MetricTile label="Review Contributions" value={formatNumber((stats?.reviewsGiven ?? 0) + (stats?.reviewsReceived ?? 0))} icon={<MessageSquare className="h-5 w-5" />} />
          <MetricTile label="Bugfix Ratio" value={`${bugfixRatio.toFixed(1)}%`} icon={<Bug className="h-5 w-5" />} />
          <MetricTile label="Code Churn Volatility" value={formatNumber((stats?.insertions ?? 0) + (stats?.deletions ?? 0))} icon={<Activity className="h-5 w-5" />} />
          <MetricTile label="Review Turnaround Latency" value={turnaroundStr} icon={<Clock className="h-5 w-5" />} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>DQS trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartSuspense>
                <TrendChart
                  data={(stats?.dqsHistory ?? []).map((point) => ({
                    date: point.date,
                    label: formatDate(point.date, { month: 'short', day: 'numeric' }),
                    value: point.score,
                  }))}
                  valueLabel="DQS"
                />
              </ChartSuspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent commits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats?.recentCommits ?? []).slice(0, 6).map((commit) => (
                <div key={commit.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="line-clamp-1 text-sm font-medium text-slate-950 dark:text-white">{commit.message}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {commit.sha.slice(0, 7)} · {formatDate(commit.committedAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </QueryState>
    </div>
  )
}
