import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, AlertTriangle, UserCheck, ShieldAlert, GitPullRequest, Search, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { reviewsService, teamsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'

export function ReviewDebtPage() {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: () => teamsService.getAll(),
  })

  const teamsResponse = teamsQuery.data as any
  const teams = Array.isArray(teamsResponse) ? teamsResponse : (teamsResponse?.data ?? [])
  const activeTeamId = selectedTeamId || teams[0]?.id || ''

  const debtQuery = useQuery({
    queryKey: queryKeys.reviews.debt(activeTeamId || 'all'),
    queryFn: () => reviewsService.getTeamDebt(activeTeamId),
    enabled: Boolean(activeTeamId),
  })

  const debtData = debtQuery.data
  const staleItems = debtData?.items ?? []
  
  const filteredItems = useMemo(() => {
    if (!searchQuery) return staleItems
    return staleItems.filter(item => 
      item.pullRequestTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reviewers?.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [staleItems, searchQuery])

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
    if (score >= 70) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
    return 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
  }

  // Get score progress color
  const getScoreProgressColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500'
    if (score >= 70) return 'bg-amber-500'
    return 'bg-rose-500'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/reviews" className="inline-flex items-center hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" /> Reviews
        </Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-slate-100 font-medium">Review Debt</span>
      </div>

      <PageHeader
        title="Review Debt Analytics"
        description="Identify pull request bottlenecks, stale reviews, and unreviewed code buildup across your teams."
        action={
          <div className="w-full sm:w-64">
            <select
              value={activeTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 shadow-sm"
              disabled={teamsQuery.isLoading}
            >
              <option value="" disabled>Select a team to analyze...</option>
              {teams.map((team: any) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <QueryState
        isLoading={teamsQuery.isLoading || debtQuery.isLoading}
        error={teamsQuery.error || debtQuery.error}
        onRetry={() => {
          teamsQuery.refetch()
          debtQuery.refetch()
        }}
      >
        {teams.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                title="No teams configured"
                description="Review debt analytics are organized by team. Create a team and assign repositories to begin monitoring review turnaround and stale PRs."
                icon={<UserCheck className="h-7 w-7 text-indigo-500" />}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top level metrics */}
            <div className="grid gap-4 md:grid-cols-4">
          <Card className={`md:col-span-1 border-2 ${debtData?.score ? getScoreColor(debtData.score).split(' ').pop() : ''}`}>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Review Health Score</h3>
              <div className={`text-5xl font-bold mb-4 ${debtData?.score ? getScoreColor(debtData.score).split(' ')[0] : 'text-slate-900'}`}>
                {debtData?.score ?? 0}
              </div>
              <Progress 
                value={debtData?.score ?? 0} 
                className="w-full h-2 mb-2" 
                indicatorClassName={debtData?.score ? getScoreProgressColor(debtData.score) : undefined} 
              />
              <p className="text-xs text-slate-500">Based on stale PRs and wait times</p>
            </CardContent>
          </Card>
          
          <div className="md:col-span-3 grid gap-4 grid-cols-1 sm:grid-cols-3">
            <MetricTile 
              label="Pending Reviews" 
              value={debtData?.pendingReviews ?? 0} 
              helper="Total PRs awaiting review"
              icon={<Clock className="h-5 w-5" />} 
            />
            <MetricTile 
              label="Avg Wait Time" 
              value={`${debtData?.avgWaitingDays?.toFixed(1) ?? 0} days`} 
              helper="Average time in review queue"
              icon={<AlertTriangle className="h-5 w-5" />} 
            />
            <MetricTile 
              label="Max Wait Time" 
              value={`${debtData?.oldestPendingReviewDays ?? 0} days`} 
              helper="Oldest pending review"
              icon={<ShieldAlert className="h-5 w-5 text-rose-500" />} 
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" /> Stale Pull Requests
                  <Badge variant="secondary" className="ml-2 font-mono">{filteredItems.length}</Badge>
                </CardTitle>
                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Search PR or reviewer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="h-4 w-4" />}
                    className="h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-[600px]">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-3">
                        <GitPullRequest className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <a href="#" className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
                            {item.pullRequestTitle}
                          </a>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                            <span>#{item.id}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-amber-500" />
                              Waiting <span className="font-semibold text-slate-700 dark:text-slate-300">{item.waitedDays} days</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={item.waitedDays > 7 ? 'destructive' : 'secondary'} className="shrink-0">
                        {item.waitedDays > 7 ? 'CRITICAL' : 'STALE'}
                      </Badge>
                    </div>
                    
                    <div className="mt-3 ml-8 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">Assigned Reviewers:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.reviewers && item.reviewers.length > 0 ? (
                          item.reviewers.map(reviewer => (
                            <div key={reviewer} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full py-1 px-2.5">
                              <Avatar name={reviewer} size="sm" className="h-4 w-4 text-[8px]" />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{reviewer}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No reviewers assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredItems.length === 0 && (
                  <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No Stale PRs</h3>
                    <p className="text-slate-500 mt-1 max-w-sm">
                      {searchQuery 
                        ? `No stale PRs found matching "${searchQuery}"`
                        : "Great job! The team is keeping up with their code reviews."}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-500" /> Reviewer Bottlenecks
              </CardTitle>
              <CardDescription>
                Team members with high pending review counts
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                {/* Aggregate reviewers from stale items */}
                {Object.entries(
                  staleItems.reduce((acc, item) => {
                    item.reviewers.forEach(r => {
                      acc[r] = (acc[r] || 0) + 1;
                    });
                    return acc;
                  }, {} as Record<string, number>)
                )
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8)
                .map(([reviewer, count]) => {
                  const maxCount = Math.max(...Object.values(
                    staleItems.reduce((acc, item) => {
                      item.reviewers.forEach(r => acc[r] = (acc[r] || 0) + 1);
                      return acc;
                    }, {} as Record<string, number>)
                  ));
                  
                  return (
                  <div key={reviewer} className="flex items-center gap-3">
                    <Avatar name={reviewer} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-end mb-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{reviewer}</p>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{count} PRs</span>
                      </div>
                      <Progress 
                        value={(count / maxCount) * 100} 
                        className="h-1.5"
                        indicatorClassName={count > 3 ? 'bg-rose-500' : count > 1 ? 'bg-amber-500' : 'bg-blue-500'}
                      />
                    </div>
                  </div>
                )})}

                {staleItems.length === 0 && (
                  <div className="py-8 flex flex-col items-center justify-center text-center text-sm text-slate-500">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="font-medium text-slate-700 dark:text-slate-300">No review bottlenecks</p>
                    <p className="text-xs text-slate-500">Workload is well-distributed across team reviewers.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </>
      )}
      </QueryState>
    </div>
  )
}
