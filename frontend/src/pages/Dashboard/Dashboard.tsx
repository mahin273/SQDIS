import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  GitCommit,
  Plus,
  Shield,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { dashboardService, repositoriesService, codeIntelligenceService } from '@/services'
import SQSTrendChart from './components/SQSTrendChart'
import CommitActivityChart from './components/CommitActivityChart'
import TeamPerformanceChart from './components/TeamPerformanceChart'
import RepositoriesTable from './components/RepositoriesTable'
import RepositoriesNeedingAttentionTable from './components/RepositoriesNeedingAttentionTable'
import DevelopersTable from './components/DevelopersTable'
import ActivityFeed from './components/ActivityFeed'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { RecentActivity } from '@/types'
import { formatDate } from '@/lib/utils'

type WorkbenchTab = 'quality' | 'commits' | 'teams'
type RepoCenterTab = 'all' | 'attention' | 'developers'
type TimeRangeOption = '7' | '30' | '90'

export default function Dashboard() {
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('quality')
  const [repoCenterTab, setRepoCenterTab] = useState<RepoCenterTab>('all')
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('30')
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<RecentActivity | null>(null)
  const [copiedSha, setCopiedSha] = useState(false)

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(),
  })

  const { data: rawRepos } = useQuery({
    queryKey: ['repositories', 'connected'],
    queryFn: () => repositoriesService.getConnected(),
  })

  const repos = useMemo(() => {
    const list = Array.isArray(rawRepos) ? rawRepos : (rawRepos as any)?.data ?? []
    return list.filter((r: any) => (r.isActive ?? r.isEnabled ?? false) && !!r.id)
  }, [rawRepos])

  const primaryRepoId = repos && repos.length > 0 ? repos[0].id : ''

  const { data: commitsRisk } = useQuery({
    queryKey: ['commits-risk', primaryRepoId],
    queryFn: () => codeIntelligenceService.getRepositoryCommitsRisk(primaryRepoId, 50),
    enabled: Boolean(primaryRepoId),
  })

  const highRiskCommitsCount = (commitsRisk || []).filter(
    (c) => c.riskLevel === 'CRITICAL' || c.riskLevel === 'HIGH',
  ).length

  const getSqsGrade = (sqs?: number) => {
    if (!sqs || sqs <= 0) return { label: 'N/A', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
    if (sqs >= 80) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' }
    if (sqs >= 65) return { label: 'Good', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800' }
    if (sqs >= 50) return { label: 'Moderate', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800' }
    return { label: 'At Risk', color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800' }
  }

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha)
    setCopiedSha(true)
    setTimeout(() => setCopiedSha(false), 2000)
  }

  const sqsGrade = getSqsGrade(stats?.avgSQS)
  const isHealthy = (stats?.riskyModulesCount ?? 0) === 0 && highRiskCommitsCount === 0

  return (
    <div className="space-y-6">
      {/* Top Header & Context Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Engineering Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Software quality metrics, repository health, and recent delivery activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live WebSocket Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-400"
            title="Connected to live event socket stream"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Stream</span>
          </div>

          {/* Global Time Range Switcher */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 text-xs">
            {(['7', '30', '90'] as TimeRangeOption[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {range}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Setup banner if no repositories exist yet */}
      {!isStatsLoading && stats && stats.totalRepositories === 0 && (
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
              Connect your first GitHub repository
            </h3>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
              Link your repositories in Settings to start tracking commit metrics, developer velocity, and ML quality scores.
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect Repository</span>
          </Link>
        </div>
      )}

      {/* Release Readiness & Engineering Health Index Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Software Quality Score (SQS) */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Software Quality Score (SQS)
            </CardTitle>
            <Shield className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isStatsLoading ? '...' : (stats?.avgSQS && stats.avgSQS > 0 ? stats.avgSQS.toFixed(1) : 'N/A')}
              </span>
              <Badge variant="outline" className={`text-[10px] font-semibold ${sqsGrade.color}`}>
                {sqsGrade.label}
              </Badge>
            </div>
            <Progress value={stats?.avgSQS ?? 0} className="h-1.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Target: 80.0 across {stats?.totalRepositories ?? 0} repositories
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Ingested Commits & Bugfix Ratio */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Commits & Defect Screening
            </CardTitle>
            <GitCommit className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isStatsLoading ? '...' : (stats?.totalCommits ?? 0).toLocaleString()}
              </span>
              <Badge variant="secondary" className="text-[10px] text-slate-600 dark:text-slate-300">
                {stats?.bugFixCommits ?? 0} bugfixes
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500">JIT Risk:</span>
              <span className={highRiskCommitsCount > 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {highRiskCommitsCount} flagged
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Defect risk evaluated on commit ingestion
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Automated Test Coverage */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Automated Test Coverage
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isStatsLoading ? '...' : (stats?.avgCoverage && stats.avgCoverage > 0 ? `${stats.avgCoverage.toFixed(1)}%` : 'N/A')}
              </span>
              <span className="text-[11px] text-slate-400">Goal: 80%</span>
            </div>
            <Progress value={stats?.avgCoverage ?? 0} className="h-1.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Aggregated from latest LCOV test reports
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Quality Gate Compliance */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Quality Gate & Security
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isStatsLoading ? '...' : (stats?.riskyModulesCount ?? 0).toString()}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold ${
                  (stats?.riskyModulesCount ?? 0) === 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                    : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                }`}
              >
                {(stats?.riskyModulesCount ?? 0) === 0 ? 'PASSED' : 'ATTENTION REQUIRED'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Contributors:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{stats?.totalDevelopers ?? 0} active</span>
              <span>·</span>
              <span>{stats?.totalTeams ?? 0} teams</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Blocking criteria on branch protection
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Triage & Risk Action Banner */}
      <div
        className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isHealthy
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
            : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg p-2 text-white shrink-0 ${
              isHealthy ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          >
            {isHealthy ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isHealthy ? 'All Quality Gates Passing' : 'Quality Gate Action Required'}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isHealthy
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}
              >
                {isHealthy ? 'Passing' : 'Attention Needed'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {isHealthy
                ? 'All connected repositories meet active quality gates and test coverage thresholds with zero defect regressions.'
                : `${highRiskCommitsCount} commits flagged with high JIT defect risk. ${stats?.riskyModulesCount ?? 0} active Quality Gate alerts require review.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/code-intelligence"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Cpu className="h-3.5 w-3.5 text-indigo-500" />
            <span>Code Intelligence</span>
          </Link>
          <Link
            to="/alerts"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 shadow-xs hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
          >
            <span>Triage Alerts</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Main Grid: Trends & Repositories on Left, Activity on Right */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (60%): Trends & Repository Overview */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Trends & Analytics Card */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  Trends & Analytics
                </CardTitle>
                <CardDescription>Quality scores, commit volume, and team distribution</CardDescription>
              </div>

              {/* Workbench Tab Switcher */}
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setWorkbenchTab('quality')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    workbenchTab === 'quality'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Quality Trend
                </button>
                <button
                  type="button"
                  onClick={() => setWorkbenchTab('commits')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    workbenchTab === 'commits'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Commit Cadence
                </button>
                <button
                  type="button"
                  onClick={() => setWorkbenchTab('teams')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    workbenchTab === 'teams'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Team Ownership
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {workbenchTab === 'quality' && <SQSTrendChart />}
              {workbenchTab === 'commits' && <CommitActivityChart />}
              {workbenchTab === 'teams' && <TeamPerformanceChart />}
            </CardContent>
          </Card>

          {/* Connected Repositories & Contributors */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Box className="h-5 w-5 text-indigo-500" />
                  Repositories & Contributors
                </CardTitle>
                <CardDescription>Repository quality scores, test coverage, and contributor activity</CardDescription>
              </div>

              {/* Repo Center Tabs */}
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setRepoCenterTab('all')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    repoCenterTab === 'all'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Repositories ({repos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRepoCenterTab('attention')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    repoCenterTab === 'attention'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Attention Needed ({stats?.riskyModulesCount ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRepoCenterTab('developers')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    repoCenterTab === 'developers'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Top Contributors ({stats?.totalDevelopers ?? 0})
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 p-0">
              {repoCenterTab === 'all' && <RepositoriesTable />}
              {repoCenterTab === 'attention' && <RepositoriesNeedingAttentionTable />}
              {repoCenterTab === 'developers' && <DevelopersTable />}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (40%): Recent Activity Feed */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <ActivityFeed onItemClick={(item) => setSelectedDrawerItem(item)} />
        </div>
      </div>

      {/* Slide-Over Inspection Drawer */}
      <Sheet open={!!selectedDrawerItem} onOpenChange={(open) => !open && setSelectedDrawerItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selectedDrawerItem && (
            <div className="space-y-6 pt-2">
              <SheetHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={
                      selectedDrawerItem.type?.toLowerCase() === 'commit'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                        : selectedDrawerItem.type?.toLowerCase() === 'alert'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                        : selectedDrawerItem.type?.toLowerCase() === 'release'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                    }
                  >
                    {selectedDrawerItem.type?.toUpperCase()}
                  </Badge>
                  {selectedDrawerItem.metadata?.classification && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedDrawerItem.metadata.classification}
                    </Badge>
                  )}
                  {selectedDrawerItem.metadata?.severity && (
                    <Badge
                      className={
                        selectedDrawerItem.metadata.severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white'
                          : selectedDrawerItem.metadata.severity === 'HIGH'
                          ? 'bg-orange-500 text-white'
                          : 'bg-amber-500 text-white'
                      }
                    >
                      {selectedDrawerItem.metadata.severity}
                    </Badge>
                  )}
                </div>
                <SheetTitle className="text-base font-bold text-slate-900 dark:text-slate-100 text-left">
                  {selectedDrawerItem.title}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 text-left">
                  {selectedDrawerItem.repositoryName || 'SQDIS'} · {formatDate(selectedDrawerItem.timestamp)}
                </SheetDescription>
              </SheetHeader>

              {/* Author & Context Information */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {selectedDrawerItem.authorAvatar ? (
                    <img
                      src={selectedDrawerItem.authorAvatar}
                      alt={selectedDrawerItem.author || 'Author'}
                      className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                      {(selectedDrawerItem.author || 'A')[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {selectedDrawerItem.author || 'System'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedDrawerItem.repositoryName || 'SQDIS'}
                    </p>
                  </div>
                </div>

                {selectedDrawerItem.metadata?.shortSha && (
                  <button
                    type="button"
                    onClick={() => handleCopySha(selectedDrawerItem.metadata?.sha || selectedDrawerItem.metadata?.shortSha || '')}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200/60 dark:bg-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                    title="Click to copy SHA"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedSha ? 'Copied!' : selectedDrawerItem.metadata.shortSha}</span>
                  </button>
                )}
              </div>

              {/* Full Description / Message */}
              {selectedDrawerItem.description && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Full Description / Message
                  </h4>
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words border border-slate-200 dark:border-slate-800">
                    {selectedDrawerItem.description}
                  </div>
                </div>
              )}

              {/* Commit Line Deltas & Churn Metrics */}
              {selectedDrawerItem.type?.toLowerCase() === 'commit' && selectedDrawerItem.metadata && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Changeset Metrics
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center">
                      <p className="text-[11px] text-slate-400">Lines Added</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        +{selectedDrawerItem.metadata.linesAdded ?? 0}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center">
                      <p className="text-[11px] text-slate-400">Lines Deleted</p>
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                        -{selectedDrawerItem.metadata.linesDeleted ?? 0}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center">
                      <p className="text-[11px] text-slate-400">Files Changed</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {selectedDrawerItem.metadata.filesChanged ?? 1}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Links */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedDrawerItem(null)}
                >
                  Dismiss
                </Button>

                <Link
                  to={
                    selectedDrawerItem.type?.toLowerCase() === 'commit'
                      ? '/commits'
                      : selectedDrawerItem.type?.toLowerCase() === 'alert'
                      ? '/alerts'
                      : selectedDrawerItem.type?.toLowerCase() === 'release'
                      ? '/releases'
                      : '/debt'
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <span>Open Full View</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
