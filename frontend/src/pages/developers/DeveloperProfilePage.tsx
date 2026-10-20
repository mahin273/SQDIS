import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GitCommit,
  ShieldCheck,
  MessageSquare,
  Bug,
  Activity,
  Clock,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Award,
  Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChartSuspense, TrendChart, ShapAttributionChart, ScoreGauge } from '@/components/charts'
import { developersService, scoresService } from '@/services'
import { formatDate, formatNumber } from '@/lib/utils'
import { QueryState, formatScore } from '../pageUtils'

function getDqsTier(score?: number | null) {
  if (score === null || score === undefined) {
    return {
      label: 'Unrated',
      variant: 'secondary' as const,
      color: 'text-slate-500 dark:text-slate-400',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    }
  }
  if (score >= 80) {
    return {
      label: 'Elite',
      variant: 'success' as const,
      color: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    }
  }
  if (score >= 70) {
    return {
      label: 'Proficient',
      variant: 'default' as const,
      color: 'text-blue-600 dark:text-blue-400',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    }
  }
  if (score >= 60) {
    return {
      label: 'Moderate',
      variant: 'warning' as const,
      color: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    }
  }
  return {
    label: 'Developing',
    variant: 'destructive' as const,
    color: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  }
}

export function DeveloperProfilePage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('explainability')

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

  const shapQuery = useQuery({
    queryKey: ['developers', 'shap', id],
    queryFn: () => scoresService.getDQSExplanation(id),
    enabled: !!id,
  })

  const recalculateMutation = useMutation({
    mutationFn: () => scoresService.recalculate({ entityId: id, type: 'DQS' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['developers', 'detail', id] }),
        queryClient.invalidateQueries({ queryKey: ['developers', 'stats', id] }),
        queryClient.invalidateQueries({ queryKey: ['developers', 'shap', id] }),
      ])
      toast.success('DQS successfully recalculated with latest telemetry')
    },
    onError: (err: any) => {
      toast.error('Failed to recalculate DQS', {
        description: err?.message || 'Calculation service unreachable',
      })
    },
  })

  const developer = developerQuery.data
  const stats = statsQuery.data
  const shapData = shapQuery.data

  const currentDqs = stats?.dqs ?? developer?.dqs ?? 0
  const tier = getDqsTier(currentDqs)

  const bugfixRatio = stats
    ? (stats.techDebtResolved / Math.max(1, stats.techDebtIntroduced + stats.techDebtResolved)) * 100
    : 0

  const turnaroundStr = stats?.avgReviewTurnaround
    ? stats.avgReviewTurnaround > 60
      ? `${(stats.avgReviewTurnaround / 60).toFixed(1)}h`
      : `${stats.avgReviewTurnaround}m`
    : 'No reviews'

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/developers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Developer Directory</span>
        </Link>
      </div>

      <QueryState
        isLoading={developerQuery.isLoading || statsQuery.isLoading || shapQuery.isLoading}
        error={developerQuery.error || statsQuery.error || shapQuery.error}
        onRetry={() => {
          developerQuery.refetch()
          statsQuery.refetch()
          shapQuery.refetch()
        }}
      >
        {/* Contributor Hero Banner */}
        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  name={developer?.name || stats?.name || 'Developer'}
                  src={developer?.avatarUrl || stats?.avatarUrl}
                  className="h-16 w-16 ring-2 ring-blue-500/20 text-lg shadow-xs"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {developer?.name || stats?.name || 'Developer Profile'}
                    </h1>
                    <Badge variant={developer?.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {developer?.status || 'ACTIVE'}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {developer?.role || stats?.role || 'DEVELOPER'}
                    </Badge>
                    {stats?.teams && stats.teams.length > 0 && (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 text-[11px]">
                        <Briefcase className="h-3 w-3 mr-1" />
                        {stats.teams[0].name}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {developer?.email || stats?.email || 'No email provided'} · Member of SQDIS Engineering
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => recalculateMutation.mutate()}
                  disabled={recalculateMutation.isPending}
                  className="h-9 gap-1.5 text-xs font-semibold"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 text-blue-500 ${
                      recalculateMutation.isPending ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{recalculateMutation.isPending ? 'Recalculating...' : 'Recalculate DQS'}</span>
                </Button>
                <Link to="/scores">
                  <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-slate-600 dark:text-slate-300">
                    <Award className="h-3.5 w-3.5" />
                    <span>Org Benchmark</span>
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4-Card Contributor Executive Strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Quality Score</span>
                <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${tier.badgeClass}`}>
                  {tier.label}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                  {formatScore(currentDqs)}
                </span>
                <span className="text-xs text-slate-400">Target: 80.0</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Machine learning quality index
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Commit Cadence</span>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <GitCommit className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                  {formatNumber(stats?.commits ?? 0)}
                </span>
                <span className="text-xs text-slate-400">Total Authored</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Recorded in organization repos
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Code Churn Volume</span>
                <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatNumber(stats?.insertions ?? 0)}
                </span>
                <span className="text-lg font-bold text-rose-500">
                  -{formatNumber(stats?.deletions ?? 0)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Net lifetime modified lines
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Debt Resolution</span>
                <div className="rounded-lg bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <Bug className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                  {bugfixRatio.toFixed(0)}%
                </span>
                <span className="text-xs text-slate-400">
                  {stats?.techDebtIntroduced ?? 0} Introduced
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Resolved vs introduced debt ratio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 3-Tab Operational Workbench */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="border-b border-slate-200 bg-transparent p-0 dark:border-slate-800">
            <TabsTrigger
              value="explainability"
              className="relative h-10 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-semibold text-slate-500 hover:text-slate-900 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 dark:text-slate-400 dark:hover:text-slate-100 dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-blue-400"
            >
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="h-4 w-4" />
                <span>AI Explainability & DQS Drivers</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="commits"
              className="relative h-10 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-semibold text-slate-500 hover:text-slate-900 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 dark:text-slate-400 dark:hover:text-slate-100 dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-blue-400"
            >
              <div className="flex items-center gap-2 text-xs">
                <GitCommit className="h-4 w-4" />
                <span>Commit Stream & Velocity ({stats?.commits ?? 0})</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="debt"
              className="relative h-10 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-semibold text-slate-500 hover:text-slate-900 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 dark:text-slate-400 dark:hover:text-slate-100 dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-blue-400"
            >
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4" />
                <span>Technical Debt & Quality Risk ({stats?.techDebtIntroduced ?? 0})</span>
              </div>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AI EXPLAINABILITY & DQS DRIVERS */}
          <TabsContent value="explainability" className="space-y-6 pt-2">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Score Gauge Card */}
              <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Developer Quality Benchmark
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        XGBoost model scoring across code hygiene, testing, and delivery cadence.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={`font-semibold ${tier.badgeClass}`}>
                      {tier.label} Tier
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex flex-col items-center justify-center">
                    <ScoreGauge value={currentDqs} max={100} label="Current DQS" size="md" />
                    <div className="mt-4 grid grid-cols-3 gap-3 w-full text-center border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div>
                        <span className="text-[11px] text-slate-400">Target Level</span>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">80.0</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Org Average</span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">72.7</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Review Turnaround</span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{turnaroundStr}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 30-Day DQS History Trendline */}
              <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                    30-Day DQS Score History
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Trajectory of developer quality evaluations over time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <ChartSuspense>
                    <TrendChart
                      data={(stats?.dqsHistory ?? []).map((point) => ({
                        date: point.date,
                        label: formatDate(point.date, { month: 'short', day: 'numeric' }),
                        value: point.score,
                      }))}
                      valueLabel="DQS Score"
                    />
                  </ChartSuspense>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row: SHAP Feature Attributions + Coaching Recommendations */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* SHAP Diverging Bar Chart */}
              <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                        SHAP Feature Attribution (Impact on DQS)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Green bars raise the score; red bars represent quality penalties.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      XGBoost Explainer
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <ChartSuspense>
                    <ShapAttributionChart shapValues={shapData?.shapValues ?? {}} />
                  </ChartSuspense>
                </CardContent>
              </Card>

              {/* AI Quality Coaching Recommendations */}
              <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Automated AI Coaching & Insights
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Actionable steps to elevate this contributor to the next performance tier.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2 space-y-4">
                  {/* Coaching Box */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/40 text-xs">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-blue-900 dark:text-blue-200">
                          Primary Quality Driver
                        </span>
                        <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                          {shapData?.recommendation ||
                            'High commit velocity demonstrates strong delivery cadence. Increasing unit test coverage on touched files will mitigate defect risks.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feature Breakdown Table */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Evaluated Metrics Breakdown
                    </span>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-800 overflow-hidden text-xs">
                      {shapData?.topFeatures && shapData.topFeatures.length > 0 ? (
                        shapData.topFeatures.slice(0, 4).map((f: any) => (
                          <div key={f.feature} className="flex items-center justify-between p-2.5 bg-slate-50/40 dark:bg-slate-900">
                            <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                              {f.feature.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono text-[11px]">
                                {typeof f.value === 'number' ? f.value.toFixed(1) : 'N/A'}
                              </span>
                              <span
                                className={`font-bold font-mono text-xs ${
                                  (f.impact || 0) >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {(f.impact || 0) >= 0 ? `+${(f.impact || 0).toFixed(1)}` : (f.impact || 0).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-slate-400">
                          Telemetry models running evaluations...
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: COMMIT STREAM & VELOCITY */}
          <TabsContent value="commits" className="space-y-6 pt-2">
            <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Recent Commits & Code Churn Stream
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Authored commits with ML classifications and line deltas.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {stats?.commits ?? 0} Commits Recorded
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {(stats?.recentCommits ?? []).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No commits recorded for this developer.
                    </div>
                  ) : (
                    (stats?.recentCommits ?? []).map((commit) => (
                      <div
                        key={commit.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {commit.classification ? (
                              <Badge
                                variant={
                                  commit.classification === 'BUGFIX'
                                    ? 'destructive'
                                    : commit.classification === 'FEATURE'
                                    ? 'success'
                                    : 'secondary'
                                }
                                className="text-[10px] uppercase font-mono px-1.5 py-0.2"
                              >
                                {commit.classification}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0.2">
                                COMMIT
                              </Badge>
                            )}
                            <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {commit.sha.slice(0, 7)}
                            </span>
                            {commit.repository?.name && (
                              <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {commit.repository.name}
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-2 text-xs font-medium text-slate-900 dark:text-slate-100">
                            {commit.message}
                          </p>
                        </div>

                        {/* Churn Delta & Timestamp */}
                        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              +{commit.linesAdded}
                            </span>
                            <span className="text-rose-500 font-semibold">
                              -{commit.linesDeleted}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {formatDate(commit.committedAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: TECHNICAL DEBT & QUALITY RISK */}
          <TabsContent value="debt" className="space-y-6 pt-2">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Technical Debt Markers
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Static code markers (TODO, FIXME, HACK) introduced in commits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-4 rounded-xl border border-rose-200/80 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/40">
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                        Introduced Debt
                      </span>
                      <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                        {stats?.techDebtIntroduced ?? 0}
                      </p>
                      <span className="text-[11px] text-slate-500">Unresolved code debt</span>
                    </div>

                    <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        Resolved Debt
                      </span>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {stats?.techDebtResolved ?? 0}
                      </p>
                      <span className="text-[11px] text-slate-500">Fixed & closed items</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Debt Resolution Rate
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {bugfixRatio.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, bugfixRatio))}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Quality Gate Compliance & Coverage
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Automated testing coverage and peer review turnaround.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Test Coverage on Touched Files
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatScore(stats?.codeCoverage)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Average Review Turnaround
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {turnaroundStr}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Peer Reviews Conducted
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {stats?.reviewsGiven ?? 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </QueryState>
    </div>
  )
}
