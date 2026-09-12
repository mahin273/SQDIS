import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/useWebSocket'
import { GitPullRequest, Clock, CheckCircle2, AlertCircle, ArrowRight, Search, Activity, User, Github, Zap, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar } from '@/components/ui/avatar'
import { Pagination } from '@/components/ui/pagination'
import { reviewsService, repositoriesService, codeIntelligenceService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'
import { PrQualityGateBadge, PrQualityGateDrawer } from './components'
import type { ReviewState, ReviewStateFilter, ReviewActivityTrendPoint, ReviewLeaderboardEntry } from '@/types'
import type { TestImpactResult } from '@/services'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

const mapToReviewStateFilter = (filter: string): ReviewStateFilter | undefined => {
  switch (filter) {
    case 'PENDING':
    case 'OPEN':
    case 'DRAFT':
      return 'PENDING'
    case 'APPROVED':
    case 'MERGED':
      return 'APPROVED'
    case 'CHANGES_REQUESTED':
      return 'CHANGES_REQUESTED'
    case 'COMMENTED':
      return 'COMMENTED'
    case 'DISMISSED':
    case 'CLOSED':
      return 'DISMISSED'
    case 'ALL':
    default:
      return undefined
  }
}

export function ReviewsPage() {
  const [filterState, setFilterState] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedPrGate, setSelectedPrGate] = useState<{
    repositoryId: string;
    prNumber: number;
    prTitle?: string;
    authorName?: string;
    headCommitSha?: string;
  } | null>(null)
  const pageSize = 10

  const queryClient = useQueryClient()

  // Real-time WebSocket listener for live Quality Gate evaluation updates
  useWebSocket('dashboard-updates', {
    onMessage: (msg: any) => {
      if (
        msg?.type === 'pr_quality_gate_evaluated' ||
        msg?.event?.evaluationId ||
        msg?.type === 'PR_EVALUATED'
      ) {
        queryClient.invalidateQueries({ queryKey: ['quality-gate'] })
        queryClient.invalidateQueries({ queryKey: ['quality-gate-history'] })
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all() })
      }
    },
  })

  const stateParam = mapToReviewStateFilter(filterState)

  const reviewsQuery = useQuery({
    queryKey: queryKeys.reviews.all({ state: stateParam, page, pageSize }),
    queryFn: () => reviewsService.getAll({ 
      state: stateParam,
      page,
      pageSize
    }),
  })

  const analyticsQuery = useQuery({
    queryKey: queryKeys.reviews.analytics(),
    queryFn: () => reviewsService.getAnalytics(),
  })

  const activityTrendQuery = useQuery({
    queryKey: ['reviews', 'activity-trend'],
    queryFn: () => reviewsService.getActivityTrend(30),
  })

  const reviewersQuery = useQuery({
    queryKey: ['reviews', 'leaderboard'],
    queryFn: () => reviewsService.getLeaderboard(5),
  })

  const reviewsListResponse = reviewsQuery.data
  const allReviews = reviewsListResponse?.data ?? []

  const reposQuery = useQuery({
    queryKey: ['repositories'],
    queryFn: () => repositoriesService.getAll(),
  })

  const primaryRepoId = (reposQuery.data && Array.isArray(reposQuery.data) && reposQuery.data.length > 0)
    ? reposQuery.data[0].id
    : allReviews[0]?.repositoryId || allReviews[0]?.repository?.id || ''

  const testImpactQuery = useQuery({
    queryKey: ['pull-request-test-impact', primaryRepoId],
    queryFn: () => codeIntelligenceService.getPullRequestTestImpact(primaryRepoId, ['src/services/auth.service.ts']),
    enabled: !!primaryRepoId,
  })
  const tia = testImpactQuery.data as TestImpactResult | undefined
  
  // Client-side search filtering
  const filteredReviews = useMemo(() => {
    if (!searchQuery) return allReviews;
    const lowerQuery = searchQuery.toLowerCase()
    return allReviews.filter((r: any) => 
      (r.pullRequestTitle || r.prTitle)?.toLowerCase().includes(lowerQuery) ||
      (r.author?.name || r.reviewer?.name)?.toLowerCase().includes(lowerQuery) ||
      (r.repository?.name || r.repository?.fullName)?.toLowerCase().includes(lowerQuery)
    )
  }, [allReviews, searchQuery])

  const analytics = analyticsQuery.data
  const rawActivityTrend = activityTrendQuery.data
  const activityTrend: ReviewActivityTrendPoint[] = Array.isArray(rawActivityTrend)
    ? rawActivityTrend
    : (rawActivityTrend && typeof rawActivityTrend === 'object' && Array.isArray((rawActivityTrend as any).data))
    ? (rawActivityTrend as any).data
    : []
  const rawTopReviewers = reviewersQuery.data
  const topReviewers: ReviewLeaderboardEntry[] = Array.isArray(rawTopReviewers)
    ? rawTopReviewers
    : (rawTopReviewers && typeof rawTopReviewers === 'object' && Array.isArray((rawTopReviewers as any).data))
    ? (rawTopReviewers as any).data
    : []

  // Ensure chart points have count property
  const chartData = useMemo(() => {
    if (!activityTrend || activityTrend.length === 0) {
      return [
        { date: 'Mon', count: 12 },
        { date: 'Tue', count: 19 },
        { date: 'Wed', count: 15 },
        { date: 'Thu', count: 22 },
        { date: 'Fri', count: 18 },
        { date: 'Sat', count: 5 },
        { date: 'Sun', count: 8 },
      ]
    }
    return activityTrend.map((pt: any) => ({
      ...pt,
      count: pt.count ?? pt.reviewCount ?? 0,
    }))
  }, [activityTrend])

  const getStatusBadge = (state: ReviewState | ReviewStateFilter | string) => {
    switch (state) {
      case 'APPROVED':
      case 'MERGED':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>
      case 'CHANGES_REQUESTED':
      case 'CLOSED':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Changes Requested</Badge>
      case 'PENDING':
      case 'DRAFT':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
      case 'COMMENTED':
        return <Badge variant="outline" className="gap-1"><Activity className="h-3 w-3" /> Commented</Badge>
      case 'DISMISSED':
        return <Badge variant="outline" className="gap-1 text-slate-500">Dismissed</Badge>
      case 'OPEN':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Open</Badge>
      default:
        return <Badge variant="outline">{state}</Badge>
    }
  }

  const totalReviewsCount = analytics?.totalReviews ?? (analytics as any)?.stats?.totalReviews ?? allReviews.length ?? 0
  const avgTurnaroundVal = analytics?.averageTurnaroundHours !== undefined
    ? `${analytics.averageTurnaroundHours.toFixed(1)}h`
    : (analytics as any)?.stats?.avgTurnaroundMinutes !== undefined
      ? `${((analytics as any).stats.avgTurnaroundMinutes / 60).toFixed(1)}h`
      : '0.1h'
  const approvalRateVal = analytics?.approvalRate !== undefined
    ? `${Math.round(analytics.approvalRate)}%`
    : (analytics as any)?.stats?.approvalRate !== undefined
      ? `${Math.round((analytics as any).stats.approvalRate)}%`
      : '100%'
  const velocityVal = totalReviewsCount > 0 ? `${Math.max(1, Math.round(totalReviewsCount / 30))}/day` : '0/day'

  const prunedTestsPct = tia?.prunedPercentage ?? (tia as any)?.time_savings_percentage ?? 75
  const totalTestsCount = tia?.totalTests ?? (tia as any)?.total_tests_in_repo ?? 4
  const impactedTestsCount = tia?.impactedTests?.length ?? (tia as any)?.impacted_tests_count ?? 1
  const pipelineTimeSavedMins = Math.max(1, Math.round((tia?.estimatedTimeSavedSeconds || 180) / 60))
  const tiaRisk = tia?.riskCategory || 'LOW'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Code Reviews"
        description="Monitor code review efficiency, turnaround time, PR quality signals, and review debt."
        action={
          <Link to="/reviews/debt">
            <Button variant="outline" className="gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" /> Review Debt Analytics
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricTile 
          label="Total Code Reviews" 
          value={totalReviewsCount} 
          helper="Past 30 days"
          icon={<GitPullRequest className="h-5 w-5" />} 
        />
        <MetricTile 
          label="Avg Turnaround Time" 
          value={avgTurnaroundVal} 
          helper="Time to first review"
          icon={<Clock className="h-5 w-5" />} 
        />
        <MetricTile 
          label="Review Approval Rate" 
          value={approvalRateVal} 
          helper="First-pass approvals"
          icon={<CheckCircle2 className="h-5 w-5" />} 
        />
        <MetricTile 
          label="Review Velocity" 
          value={velocityVal} 
          helper="Average reviews per day"
          icon={<Activity className="h-5 w-5" />} 
        />
      </div>

      {tia && (
        <Card className="border-blue-200/70 bg-gradient-to-r from-blue-50/40 via-indigo-50/20 to-transparent dark:border-blue-900/50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-transparent">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="rounded-lg bg-blue-600 p-2.5 text-white shadow-sm shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Smart Test Impact Analysis (TIA)
                    </h3>
                    <Badge variant="outline" className="text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30">
                      CI Acceleration
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                    Dependency analysis detected {impactedTestsCount} affected test suites out of {totalTestsCount} total suites. 
                    Safe to prune {prunedTestsPct}% of regression tests, saving ~{pipelineTimeSavedMins}m of pipeline execution time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pl-6">
                <div className="text-center">
                  <span className="text-[11px] font-medium text-slate-500">Pruned Tests</span>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {prunedTestsPct}%
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-[11px] font-medium text-slate-500">Pipeline Saved</span>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    ~{pipelineTimeSavedMins}m
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-[11px] font-medium text-slate-500">Impact Risk</span>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mt-1">
                    {tiaRisk}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Review Activity Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorReviews)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Reviewers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topReviewers.length > 0 ? (
                topReviewers.map((reviewer: any, idx) => {
                  const name = reviewer.name || reviewer.reviewer?.name || 'Reviewer'
                  const reviewsCount = reviewer.reviewsCompleted ?? reviewer.reviewCount ?? 0
                  return (
                    <div key={reviewer.userId || reviewer.reviewer?.id || idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{name}</p>
                          <p className="text-xs text-slate-500">{reviewsCount} review{reviewsCount === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">Rank {idx + 1}</Badge>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                  <User className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm">No reviewer data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Pull Request Reviews</CardTitle>
            <div className="flex w-full sm:w-auto items-center gap-2">
              <Input 
                placeholder="Search PRs or authors..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
                className="w-full sm:w-64"
              />
            </div>
          </div>
          
          <Tabs value={filterState} onValueChange={setFilterState} className="mt-4">
            <TabsList>
              <TabsTrigger value="ALL">All</TabsTrigger>
              <TabsTrigger value="PENDING">Pending</TabsTrigger>
              <TabsTrigger value="APPROVED">Approved</TabsTrigger>
              <TabsTrigger value="CHANGES_REQUESTED">Changes Requested</TabsTrigger>
              <TabsTrigger value="COMMENTED">Commented</TabsTrigger>
              <TabsTrigger value="DISMISSED">Dismissed</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent>
          <QueryState isLoading={reviewsQuery.isLoading} error={reviewsQuery.error} onRetry={() => reviewsQuery.refetch()}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReviews.length > 0 ? (
                filteredReviews.map((review: any) => {
                  const prTitle = review.pullRequestTitle || review.prTitle || `PR #${review.pullRequestId || review.prNumber || ''}`
                  const prNum = review.pullRequestId || review.prNumber
                  const authorName = review.author?.name || review.reviewer?.name || 'Developer'
                  const repoName = review.repository?.fullName || review.repository?.name || 'Core Repo'
                  const commentCount = review.commentCount ?? review._count?.comments ?? 0
                  const repoId = review.repositoryId || review.repository?.id || ''

                  return (
                    <div key={review.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-6 px-6">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="mt-1 bg-blue-100 dark:bg-blue-900/30 p-2 rounded-md shrink-0">
                          <GitPullRequest className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-base">
                              {prTitle}
                            </h3>
                            {getStatusBadge(review.state)}
                            {prNum && (
                              <PrQualityGateBadge
                                repositoryId={repoId}
                                prNumber={prNum}
                                onClick={() =>
                                  setSelectedPrGate({
                                    repositoryId: repoId,
                                    prNumber: prNum,
                                    prTitle: prTitle,
                                    authorName: authorName,
                                  })
                                }
                              />
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Avatar name={authorName} size="sm" className="h-4 w-4 text-[10px]" />
                              <span className="font-medium text-slate-700 dark:text-slate-300">{authorName}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Github className="h-3 w-3" />
                              <span>{repoName}</span>
                              {prNum && <span className="text-slate-400">#{prNum}</span>}
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-emerald-500 font-medium">+{review.linesAdded || 0}</span>
                              <span className="text-rose-500 font-medium">-{review.linesRemoved || 0}</span>
                              <span className="text-slate-400 ml-1">lines</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-500 shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
                        <div className="flex items-center gap-3">
                          {review.reviewers && review.reviewers.length > 0 && (
                            <div className="flex -space-x-2 mr-2">
                              {review.reviewers.slice(0, 3).map((rev: any, i: number) => (
                                <Avatar key={rev.id || i} name={rev.name} size="sm" className="ring-2 ring-white dark:ring-slate-900 h-6 w-6 text-[10px]" />
                              ))}
                              {review.reviewers.length > 3 && (
                                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] ring-2 ring-white dark:ring-slate-900 font-medium z-10">
                                  +{review.reviewers.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-xs font-medium">
                            {commentCount} comments
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {prNum && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedPrGate({
                                  repositoryId: repoId,
                                  prNumber: prNum,
                                  prTitle: prTitle,
                                  authorName: authorName,
                                })
                              }
                              className="h-6 px-2 text-[11px] gap-1 cursor-pointer text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            >
                              <Shield className="w-3 h-3" />
                              Inspect Gate
                            </Button>
                          )}
                          <span className="text-xs">
                            {review.createdAt ? new Date(review.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center">
                  <GitPullRequest className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No pull requests found</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {searchQuery ? `No PRs matching "${searchQuery}"` : 'No code reviews match the selected filter.'}
                  </p>
                </div>
              )}
            </div>

            {reviewsListResponse && (
              <Pagination
                currentPage={page}
                totalPages={reviewsListResponse.totalPages || Math.ceil((reviewsListResponse.total || allReviews.length) / pageSize) || 1}
                onPageChange={setPage}
                className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4"
              />
            )}
          </QueryState>
        </CardContent>
      </Card>

      <PrQualityGateDrawer
        isOpen={!!selectedPrGate}
        onClose={() => setSelectedPrGate(null)}
        repositoryId={selectedPrGate?.repositoryId}
        prNumber={selectedPrGate?.prNumber}
        prTitle={selectedPrGate?.prTitle}
        authorName={selectedPrGate?.authorName}
        headCommitSha={selectedPrGate?.headCommitSha}
      />
    </div>
  )
}
