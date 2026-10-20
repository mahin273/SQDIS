import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  GitCommit,
  GitPullRequest,
  Search,
  Plus,
  GitBranch,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Zap,
  Filter,
  FileCode,
  FileText,
  User,
  X,
  TrendingUp,
  Activity,
  ArrowUpRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { CommitChart, ChartSuspense } from '@/components/charts'
import { commitsService, repositoriesService } from '@/services'
import { codeIntelligenceService, type CommitRiskItem } from '@/services/codeIntelligence.service'
import { formatDate, formatNumber, cn } from '@/lib/utils'
import { Pagination } from '@/components/ui/pagination'
import { QueryState } from '../pageUtils'
import type { Commit, CommitClassification } from '@/types'

const CLASSIFICATION_OPTIONS: Array<{
  value: string
  label: string
  dotColor: string
  activeClass: string
}> = [
  {
    value: 'ALL',
    label: 'All Types',
    dotColor: 'bg-indigo-400',
    activeClass: 'border-indigo-500 bg-indigo-600 text-white shadow-xs font-semibold',
  },
  {
    value: 'FEATURE',
    label: 'Features',
    dotColor: 'bg-emerald-400',
    activeClass: 'border-emerald-500 bg-emerald-600 text-white shadow-xs font-semibold',
  },
  {
    value: 'BUGFIX',
    label: 'Bug Fixes',
    dotColor: 'bg-amber-400',
    activeClass: 'border-amber-500 bg-amber-600 text-white shadow-xs font-semibold',
  },
  {
    value: 'REFACTOR',
    label: 'Refactor',
    dotColor: 'bg-sky-400',
    activeClass: 'border-sky-500 bg-sky-600 text-white shadow-xs font-semibold',
  },
  {
    value: 'TEST',
    label: 'Tests',
    dotColor: 'bg-purple-400',
    activeClass: 'border-purple-500 bg-purple-600 text-white shadow-xs font-semibold',
  },
  {
    value: 'DOCS',
    label: 'Docs',
    dotColor: 'bg-teal-400',
    activeClass: 'border-teal-500 bg-teal-600 text-white shadow-xs font-semibold',
  },
  {
    value: 'CHORE',
    label: 'Chores',
    dotColor: 'bg-slate-400',
    activeClass: 'border-slate-500 bg-slate-600 text-white shadow-xs font-semibold',
  },
]

const RISK_LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All Defect Risks' },
  { value: 'CRITICAL', label: 'Critical Risk' },
  { value: 'HIGH', label: 'High Risk' },
  { value: 'MODERATE', label: 'Moderate Risk' },
  { value: 'LOW', label: 'Low / Guarded' },
]

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return ''
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function getClassificationBadge(classification?: string) {
  switch (classification) {
    case 'FEATURE':
      return {
        label: 'Feature',
        dotColor: 'bg-emerald-400',
        className:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-500/40 font-semibold',
      }
    case 'BUGFIX':
      return {
        label: 'Bug Fix',
        dotColor: 'bg-amber-400',
        className:
          'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:border-amber-500/40 font-semibold',
      }
    case 'REFACTOR':
      return {
        label: 'Refactor',
        dotColor: 'bg-sky-400',
        className:
          'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 dark:border-sky-500/40 font-semibold',
      }
    case 'TEST':
      return {
        label: 'Test',
        dotColor: 'bg-purple-400',
        className:
          'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 dark:border-purple-500/40 font-semibold',
      }
    case 'DOCS':
      return {
        label: 'Docs',
        dotColor: 'bg-teal-400',
        className:
          'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 dark:border-teal-500/40 font-semibold',
      }
    case 'CHORE':
      return {
        label: 'Chore',
        dotColor: 'bg-slate-400',
        className:
          'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 dark:border-slate-500/40 font-semibold',
      }
    default:
      return {
        label: classification || 'Commit',
        dotColor: 'bg-slate-400',
        className:
          'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30 dark:border-slate-500/40 font-medium',
      }
  }
}

export function CommitsPage() {
  const [search, setSearch] = useState('')
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL')
  const [riskFilter, setRiskFilter] = useState<string>('ALL')
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('')
  const [anomalyOnly, setAnomalyOnly] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Drawer Inspection State
  const [inspectedCommit, setInspectedCommit] = useState<Commit | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [copiedSha, setCopiedSha] = useState<string | null>(null)

  // Repositories Query
  const reposQuery = useQuery({
    queryKey: ['repositories', 'connected'],
    queryFn: () => repositoriesService.getConnected(),
  })

  const connectedRepos = useMemo(() => {
    const list = Array.isArray(reposQuery.data)
      ? reposQuery.data
      : (reposQuery.data as any)?.data ?? []
    return list.filter((r: any) => (r.isActive ?? r.isEnabled ?? false) && !!r.id)
  }, [reposQuery.data])

  const activeRepo = useMemo(() => {
    if (selectedRepoId) {
      return connectedRepos.find((r: any) => r.id === selectedRepoId) || null
    }
    return connectedRepos[0] || null
  }, [connectedRepos, selectedRepoId])

  const effectiveRepoId = selectedRepoId || activeRepo?.id || ''

  // Commits Query
  const commitsQuery = useQuery({
    queryKey: [
      'commits',
      'stream',
      {
        search,
        classification: classificationFilter !== 'ALL' ? classificationFilter : undefined,
        repositoryId: effectiveRepoId || undefined,
        developerId: selectedAuthorId || undefined,
        anomalyOnly: anomalyOnly || undefined,
        page: currentPage,
        pageSize,
      },
    ],
    queryFn: () =>
      commitsService.getPaginated({
        search: search || undefined,
        classification:
          classificationFilter !== 'ALL'
            ? (classificationFilter as CommitClassification)
            : undefined,
        repositoryId: effectiveRepoId || undefined,
        developerId: selectedAuthorId || undefined,
        anomalyOnly: anomalyOnly || undefined,
        page: currentPage,
        limit: pageSize,
        pageSize,
      }),
  })

  // Stats Query
  const statsQuery = useQuery({
    queryKey: ['commits', 'stats', effectiveRepoId, selectedAuthorId],
    queryFn: () =>
      commitsService.getStats({
        repositoryId: effectiveRepoId || undefined,
        developerId: selectedAuthorId || undefined,
      }),
  })

  // JIT Defect Risks Query
  const commitsRiskQuery = useQuery({
    queryKey: ['commits-risk', effectiveRepoId],
    queryFn: () => codeIntelligenceService.getRepositoryCommitsRisk(effectiveRepoId, 100),
    enabled: !!effectiveRepoId,
  })

  // Detailed Commit Query for Slide-Over Drawer
  const inspectedCommitDetailQuery = useQuery({
    queryKey: ['commit', 'detail', inspectedCommit?.id],
    queryFn: () => commitsService.getById(inspectedCommit!.id),
    enabled: !!inspectedCommit?.id && isDrawerOpen,
  })

  const commitRiskMap = useMemo(() => {
    const map = new Map<string, CommitRiskItem>()
    ;(commitsRiskQuery.data || []).forEach((item) => {
      if (item.commitSha) map.set(item.commitSha, item)
    })
    return map
  }, [commitsRiskQuery.data])

  const rawCommits = commitsQuery.data?.data || []
  const paginationMeta = commitsQuery.data?.meta || {
    total: rawCommits.length,
    page: currentPage,
    limit: pageSize,
    totalPages: Math.max(1, Math.ceil(rawCommits.length / pageSize)),
  }

  // Filter commits locally by risk level if selected
  const displayedCommits = useMemo(() => {
    if (riskFilter === 'ALL') return rawCommits
    return rawCommits.filter((c) => {
      const risk = commitRiskMap.get(c.sha)
      return risk?.riskLevel === riskFilter
    })
  }, [rawCommits, riskFilter, commitRiskMap])

  // Rolling 14-day velocity chart data
  const chartData = useMemo(() => {
    if (!rawCommits || rawCommits.length === 0) return []

    const dayMap = new Map<
      string,
      { date: string; rawDate: string; commits: number; additions: number; deletions: number }
    >()

    rawCommits.forEach((commit) => {
      if (!commit.committedAt) return
      const rawDate = new Date(commit.committedAt).toISOString().split('T')[0]
      const formatted = formatDate(commit.committedAt, { month: 'short', day: 'numeric' })
      const existing = dayMap.get(rawDate) || {
        date: formatted,
        rawDate,
        commits: 0,
        additions: 0,
        deletions: 0,
      }

      existing.commits += 1
      existing.additions += commit.linesAdded ?? commit.insertions ?? 0
      existing.deletions += commit.linesDeleted ?? commit.deletions ?? 0
      dayMap.set(rawDate, existing)
    })

    return Array.from(dayMap.values())
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-14)
  }, [rawCommits])

  // Top Authors from Stats
  const topAuthors = useMemo(() => {
    if (statsQuery.data?.topAuthors && statsQuery.data.topAuthors.length > 0) {
      return statsQuery.data.topAuthors
    }
    const authorMap = new Map<
      string,
      { authorId: string; name: string; count: number; avatarUrl?: string | null }
    >()
    rawCommits.forEach((c) => {
      const name = c.developer?.name || c.authorName || c.authorEmail?.split('@')[0] || 'Unknown'
      const key = c.developerId || c.authorEmail || name
      const cur = authorMap.get(key) || {
        authorId: key,
        name,
        count: 0,
        avatarUrl: c.developer?.avatarUrl,
      }
      cur.count += 1
      if (!cur.avatarUrl && c.developer?.avatarUrl) {
        cur.avatarUrl = c.developer.avatarUrl
      }
      authorMap.set(key, cur)
    })
    return Array.from(authorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [statsQuery.data?.topAuthors, rawCommits])

  // Total insertions and deletions
  const totalInsertions =
    statsQuery.data?.totalLinesAdded ?? statsQuery.data?.totalInsertions ?? 0
  const totalDeletions =
    statsQuery.data?.totalLinesDeleted ?? statsQuery.data?.totalDeletions ?? 0

  // Feature vs Bugfix velocity counts
  const featureCount = statsQuery.data?.classificationBreakdown?.['FEATURE'] || 0
  const bugfixCount = statsQuery.data?.classificationBreakdown?.['BUGFIX'] || 0

  // High/critical risk commits count
  const screenedCount = commitsRiskQuery.data?.length || 0
  const highRiskCount = useMemo(() => {
    return (commitsRiskQuery.data || []).filter(
      (r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL'
    ).length
  }, [commitsRiskQuery.data])

  const handleCopySha = (sha: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigator.clipboard.writeText(sha)
    setCopiedSha(sha)
    setTimeout(() => {
      setCopiedSha((prev) => (prev === sha ? null : prev))
    }, 2000)
  }

  const handleOpenDrawer = (commit: Commit) => {
    setInspectedCommit(commit)
    setIsDrawerOpen(true)
  }

  const hasActiveFilters =
    Boolean(search) ||
    classificationFilter !== 'ALL' ||
    riskFilter !== 'ALL' ||
    Boolean(selectedAuthorId) ||
    anomalyOnly

  const clearAllFilters = () => {
    setSearch('')
    setClassificationFilter('ALL')
    setRiskFilter('ALL')
    setSelectedAuthorId('')
    setAnomalyOnly(false)
    setCurrentPage(1)
  }

  const selectedAuthorName = useMemo(() => {
    if (!selectedAuthorId) return ''
    const match = topAuthors.find((a) => a.authorId === selectedAuthorId)
    return match?.name || 'Selected Author'
  }, [topAuthors, selectedAuthorId])

  const activeCommitDetails = inspectedCommitDetailQuery.data || inspectedCommit
  const activeCommitRisk = inspectedCommit
    ? commitRiskMap.get(inspectedCommit.sha) || inspectedCommit.defectPrediction
    : null

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                Commit Stream & Quality Intelligence
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Ingestion
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Commit Stream & Telemetry Hub
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Real-time engineering audit trail with ML commit classification, codebase churn
              analytics, and Kamei Just-In-Time defect risk screening.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {connectedRepos.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200">
                <GitBranch className="h-4 w-4 text-indigo-400 shrink-0" />
                <select
                  value={selectedRepoId}
                  onChange={(e) => {
                    setSelectedRepoId(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer pr-2"
                >
                  <option value="" className="bg-slate-900 text-white">
                    All Connected Repos
                  </option>
                  {connectedRepos.map((repo: any) => (
                    <option key={repo.id} value={repo.id} className="bg-slate-900 text-white">
                      {repo.fullName || repo.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                commitsQuery.refetch()
                statsQuery.refetch()
                commitsRiskQuery.refetch()
              }}
              className="border-slate-700 bg-slate-800/80 text-white hover:bg-slate-700 hover:text-white text-xs h-9"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5 mr-1.5', commitsQuery.isFetching && 'animate-spin')}
              />
              Sync Telemetry
            </Button>
          </div>
        </div>
      </div>

      {/* 4-Card Executive KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Commits */}
        <Card className="relative overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Audited Commits
              </span>
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                <GitCommit className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {formatNumber(paginationMeta.total || statsQuery.data?.totalCommits || 0)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">changesets</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              <span>Full commit history cataloged</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Code Churn & Volume */}
        <Card className="relative overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Codebase Churn Delta
              </span>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <GitPullRequest className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                +{formatNumber(totalInsertions)}
              </span>
              <span className="text-sm font-medium text-slate-400">/</span>
              <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                -{formatNumber(totalDeletions)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span>Net line volume across tracked files</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: ML Velocity Mix */}
        <Card className="relative overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Feature vs Bug Velocity
              </span>
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {featureCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                feat / {bugfixCount} fix
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>
                {bugfixCount > 0
                  ? `${(featureCount / bugfixCount).toFixed(1)}x Feature-to-Fix ratio`
                  : 'Automated ML classification'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: JIT Defect & Anomaly Screening */}
        <Card className="relative overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                JIT Defect Screening
              </span>
              <div
                className={cn(
                  'rounded-lg p-2',
                  highRiskCount > 0
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                )}
              >
                {highRiskCount > 0 ? (
                  <ShieldAlert className="h-5 w-5" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {screenedCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({highRiskCount} High Risk)
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
              <span>Kamei Just-In-Time model active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Strip: Commit Cadence & Top Contributors */}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Cadence Velocity Chart */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-6 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Commit Cadence & Churn Velocity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily commit volume and line additions vs deletions across the past 14 days
              </p>
            </div>
            <Badge variant="outline" className="text-[11px] font-normal">
              14-Day Rolling
            </Badge>
          </div>
          <CardContent className="p-5">
            <ChartSuspense>
              {chartData.length > 0 ? (
                <CommitChart data={chartData} height={260} />
              ) : (
                <div className="flex h-56 flex-col items-center justify-center text-center text-xs text-slate-400">
                  <Activity className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" />
                  <span>No recent activity data available for selected filter</span>
                </div>
              )}
            </ChartSuspense>
          </CardContent>
        </Card>

        {/* Top Contributors Interactive Sidebar */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-5 py-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Top Contributors
              </h3>
            </div>
            {selectedAuthorId && (
              <button
                type="button"
                onClick={() => setSelectedAuthorId('')}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>
          <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
            <div className="space-y-2">
              {topAuthors.length > 0 ? (
                topAuthors.slice(0, 6).map((author) => {
                  const isSelected = selectedAuthorId === author.authorId
                  return (
                    <button
                      key={author.authorId}
                      type="button"
                      onClick={() => {
                        setSelectedAuthorId(isSelected ? '' : author.authorId)
                        setCurrentPage(1)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between rounded-lg p-2.5 text-left text-xs transition-all border cursor-pointer',
                        isSelected
                          ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          src={author.avatarUrl}
                          name={author.name}
                          size="sm"
                          className="h-7 w-7 text-[10px] ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                        <span className="truncate font-medium">{author.name}</span>
                      </div>
                      <Badge
                        variant={isSelected ? 'default' : 'secondary'}
                        className="text-[11px] shrink-0 font-semibold"
                      >
                        {author.count}
                      </Badge>
                    </button>
                  )
                })
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">No author activity found</p>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              Click any author to filter the entire commit stream to their contributions.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Faceted SaaS Filter & Query Controls */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md lg:max-w-xl">
              <Input
                placeholder="Search by commit message, SHA, or author..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                leftIcon={<Search className="h-4 w-4 text-slate-400" />}
                className="h-9 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Defect Risk Filter */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-lg p-1 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-400 ml-1.5" />
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer pr-1"
                >
                  {RISK_LEVEL_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Anomaly Only Toggle */}
              <Button
                type="button"
                variant={anomalyOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setAnomalyOnly(!anomalyOnly)
                  setCurrentPage(1)
                }}
                className={cn(
                  'h-9 text-xs gap-1.5',
                  anomalyOnly && 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Anomalies Only
              </Button>

              {/* Clear filters if active */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-9 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear all
                </Button>
              )}
            </div>
          </div>

          {/* Classification Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Category:
            </span>
            {CLASSIFICATION_OPTIONS.map((opt) => {
              const isActive = classificationFilter === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setClassificationFilter(opt.value)
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer border',
                    isActive
                      ? opt.activeClass
                      : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-white' : opt.dotColor)}
                  />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Active Filter Summary Tags */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
              <span className="text-slate-400 text-[11px]">Active filters:</span>
              {search && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  Search: &quot;{search}&quot;
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch('')} />
                </Badge>
              )}
              {classificationFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  Classification: {classificationFilter}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setClassificationFilter('ALL')}
                  />
                </Badge>
              )}
              {riskFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  Risk: {riskFilter}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setRiskFilter('ALL')} />
                </Badge>
              )}
              {selectedAuthorId && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  Author: {selectedAuthorName}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedAuthorId('')} />
                </Badge>
              )}
              {anomalyOnly && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  Anomalies Only
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setAnomalyOnly(false)} />
                </Badge>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Main Commit Stream */}
      <QueryState
        isLoading={commitsQuery.isLoading}
        error={commitsQuery.error}
        onRetry={() => commitsQuery.refetch()}
      >
        {displayedCommits.length === 0 ? (
          <Card className="border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 mb-4">
                <GitBranch className="h-7 w-7 text-indigo-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No commits found matching query
              </h3>
              <p className="mt-1.5 max-w-md text-xs text-slate-500 dark:text-slate-400">
                {hasActiveFilters
                  ? 'No commits matched your current filter criteria. Try resetting filters or broadening your search.'
                  : 'No commits have been ingested for your connected repositories yet.'}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-4 text-xs">
                  Reset All Filters
                </Button>
              ) : (
                <Link
                  to="/settings"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Connect Repository
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Stream Header & Row Count */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>
                Showing{' '}
                <strong className="text-slate-900 dark:text-white">
                  {displayedCommits.length}
                </strong>{' '}
                of {paginationMeta.total} commits
              </span>
              <div className="flex items-center gap-2">
                <span>Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Commits Roster Card */}
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {displayedCommits.map((commit) => {
                  const risk = commitRiskMap.get(commit.sha)
                  const classificationBadge = getClassificationBadge(commit.classification)
                  const [subject, ...bodyLines] = commit.message.split('\n')
                  const hasBody = bodyLines.some((l) => l.trim().length > 0)
                  const isCopied = copiedSha === commit.sha

                  return (
                    <div
                      key={commit.id}
                      onClick={() => handleOpenDrawer(commit)}
                      className="p-4 sm:p-5 transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/60 cursor-pointer group"
                    >
                      <div className="grid gap-3.5 lg:grid-cols-[1fr_auto] lg:items-center">
                        {/* Commit Message & Metadata */}
                        <div className="min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Author Avatar & Name */}
                            <div className="flex items-center gap-2 mr-1">
                              <Avatar
                                src={commit.developer?.avatarUrl}
                                name={commit.authorName}
                                size="sm"
                                className="h-6 w-6 text-[10px] ring-1 ring-slate-200 dark:ring-slate-700"
                              />
                              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                {commit.developer?.name || commit.authorName}
                              </span>
                            </div>

                            {/* Classification Badge */}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[11px] px-2.5 py-0.5 inline-flex items-center gap-1.5',
                                classificationBadge.className
                              )}
                            >
                              <span
                                className={cn('h-1.5 w-1.5 rounded-full', classificationBadge.dotColor)}
                              />
                              {classificationBadge.label}
                            </Badge>

                            {/* Kamei JIT Defect Risk Badge */}
                            {risk && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenDrawer(commit)
                                }}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-colors cursor-pointer',
                                  risk.riskLevel === 'CRITICAL' &&
                                    'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35',
                                  risk.riskLevel === 'HIGH' &&
                                    'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/35',
                                  risk.riskLevel === 'MODERATE' &&
                                    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35',
                                  risk.riskLevel === 'LOW' &&
                                    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                                )}
                                title="Click to view full defect risk breakdown"
                              >
                                {risk.riskLevel === 'CRITICAL' || risk.riskLevel === 'HIGH' ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : (
                                  <ShieldCheck className="h-3 w-3" />
                                )}
                                JIT Risk: {(risk.defectProbability * 100).toFixed(0)}% {risk.riskLevel}
                              </button>
                            )}

                            {/* Anomaly Flag */}
                            {commit.anomalyFlag && (
                              <Badge
                                variant="outline"
                                className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]"
                              >
                                Anomaly
                              </Badge>
                            )}
                          </div>

                          {/* Commit Subject */}
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                              {subject}
                            </h4>
                            {hasBody && (
                              <span className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-800 rounded px-1 py-0.2">
                                +more
                              </span>
                            )}
                          </div>

                          {/* Author & Commit Details Footer */}
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            {/* Monospace SHA with 1-click Copy */}
                            <button
                              type="button"
                              onClick={(e) => handleCopySha(commit.sha, e)}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              title="Click to copy full commit SHA"
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3 text-slate-400" />
                              )}
                              <span>{commit.sha.slice(0, 7)}</span>
                            </button>

                            {/* Branch */}
                            <span className="inline-flex items-center gap-1">
                              <GitBranch className="h-3 w-3 text-slate-400" />
                              {commit.branch || 'main'}
                            </span>

                            {/* Repository */}
                            {commit.repository && (
                              <span className="text-slate-400">
                                {commit.repository.fullName || commit.repository.name}
                              </span>
                            )}

                            {/* Relative Timestamp */}
                            <span>
                              {formatTimeAgo(commit.committedAt)} ({formatDate(commit.committedAt)})
                            </span>
                          </div>
                        </div>

                        {/* Right Column: Changeset Stats & Actions */}
                        <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800/80">
                          {/* Churn Numbers */}
                          <div className="text-right">
                            <div className="flex items-center gap-2 font-mono text-xs font-semibold justify-end">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                +{commit.insertions ?? commit.linesAdded ?? 0}
                              </span>
                              <span className="text-rose-600 dark:text-rose-400">
                                -{commit.deletions ?? commit.linesDeleted ?? 0}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {commit.filesChanged || 1} files touched
                            </div>
                          </div>

                          {/* GitHub Link & Inspect Trigger */}
                          <div className="flex items-center gap-1.5">
                            {commit.repository?.fullName && (
                              <a
                                href={`https://github.com/${commit.repository.fullName}/commit/${commit.sha}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                                title="Open commit on GitHub"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Pagination Controls */}
            {paginationMeta.totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination
                  currentPage={paginationMeta.page}
                  totalPages={paginationMeta.totalPages}
                  onPageChange={(p) => {
                    setCurrentPage(p)
                    window.scrollTo({ top: 400, behavior: 'smooth' })
                  }}
                  pageSize={pageSize}
                  totalItems={paginationMeta.total}
                />
              </div>
            )}
          </div>
        )}
      </QueryState>

      {/* Slide-Over Deep Inspection Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
        >
          {activeCommitDetails && (
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <SheetHeader className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopySha(activeCommitDetails.sha)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-slate-200/80 dark:bg-slate-800 px-2 py-1 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Click to copy full commit SHA"
                    >
                      {copiedSha === activeCommitDetails.sha ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      <span>{activeCommitDetails.sha.slice(0, 8)}</span>
                    </button>

                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        getClassificationBadge(activeCommitDetails.classification).className
                      )}
                    >
                      {getClassificationBadge(activeCommitDetails.classification).label}
                    </Badge>
                  </div>

                  {activeCommitDetails.repository?.fullName && (
                    <a
                      href={`https://github.com/${activeCommitDetails.repository.fullName}/commit/${activeCommitDetails.sha}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>View on GitHub</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <SheetTitle className="text-lg font-bold text-slate-900 dark:text-white mt-2 leading-snug">
                  {activeCommitDetails.message.split('\n')[0]}
                </SheetTitle>

                {/* Author Info Strip */}
                <div className="flex items-center gap-3 pt-2">
                  <Avatar
                    src={activeCommitDetails.developer?.avatarUrl}
                    name={activeCommitDetails.authorName}
                    size="md"
                    className="h-9 w-9 ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {activeCommitDetails.developer?.name || activeCommitDetails.authorName}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {activeCommitDetails.authorEmail} ·{' '}
                      {formatTimeAgo(activeCommitDetails.committedAt)}
                    </p>
                  </div>
                </div>

                <SheetDescription className="sr-only">
                  Deep intelligence review for commit {activeCommitDetails.sha}
                </SheetDescription>
              </SheetHeader>

              {/* Drawer Body */}
              <div className="flex-1 p-6 space-y-6">
                {/* Commit Full Message Body (if multi-line) */}
                {activeCommitDetails.message.split('\n').slice(1).join('\n').trim() && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Commit Description
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
                      {activeCommitDetails.message.split('\n').slice(1).join('\n').trim()}
                    </p>
                  </div>
                )}

                {/* Kamei JIT Defect Risk Card */}
                {activeCommitRisk ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert
                          className={cn(
                            'h-5 w-5',
                            activeCommitRisk.riskLevel === 'CRITICAL'
                              ? 'text-rose-500'
                              : activeCommitRisk.riskLevel === 'HIGH'
                              ? 'text-orange-500'
                              : activeCommitRisk.riskLevel === 'MODERATE'
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          )}
                        />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Kamei JIT Defect Probability
                        </h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-bold px-2.5 py-0.5',
                          activeCommitRisk.riskLevel === 'CRITICAL' &&
                            'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
                          activeCommitRisk.riskLevel === 'HIGH' &&
                            'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
                          activeCommitRisk.riskLevel === 'MODERATE' &&
                            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                          activeCommitRisk.riskLevel === 'LOW' &&
                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        )}
                      >
                        {activeCommitRisk.riskLevel} RISK
                      </Badge>
                    </div>

                    {/* Defect Probability Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          Regression Likelihood
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {(activeCommitRisk.defectProbability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            activeCommitRisk.riskLevel === 'CRITICAL'
                              ? 'bg-rose-500'
                              : activeCommitRisk.riskLevel === 'HIGH'
                              ? 'bg-orange-500'
                              : activeCommitRisk.riskLevel === 'MODERATE'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(5, activeCommitRisk.defectProbability * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Top Risk Drivers */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        Kamei JIT Risk Drivers Flagged:
                      </p>
                      {activeCommitRisk.topRiskDrivers &&
                      activeCommitRisk.topRiskDrivers.length > 0 ? (
                        <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                          {activeCommitRisk.topRiskDrivers.map((driver: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="leading-relaxed">{driver}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4" />
                          Clean changeset. No elevated risk factors identified.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 text-xs text-slate-500 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                    <span>No precomputed defect score found for this specific changeset.</span>
                  </div>
                )}

                {/* Changeset Metrics Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Additions</span>
                    <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                      +{activeCommitDetails.insertions ?? activeCommitDetails.linesAdded ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Deletions</span>
                    <p className="text-base font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                      -{activeCommitDetails.deletions ?? activeCommitDetails.linesDeleted ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Files Touched</span>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                      {activeCommitDetails.filesChanged ||
                        activeCommitDetails.fileChanges?.length ||
                        1}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Branch</span>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-2 truncate">
                      {activeCommitDetails.branch || 'main'}
                    </p>
                  </div>
                </div>

                {/* Touched Files List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-indigo-500" />
                      Changed Files Breakdown
                    </h4>
                    <span className="text-xs text-slate-400">
                      {activeCommitDetails.fileChanges?.length || 0} files recorded
                    </span>
                  </div>

                  {inspectedCommitDetailQuery.isLoading ? (
                    <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                      Loading file-level churn telemetry...
                    </div>
                  ) : activeCommitDetails.fileChanges &&
                    activeCommitDetails.fileChanges.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                      {activeCommitDetails.fileChanges.map((fc: any) => (
                        <div
                          key={fc.id || fc.filePath}
                          className="p-3 text-xs flex items-center justify-between gap-3 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                              {fc.filePath}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              +{fc.additions}
                            </span>
                            <span className="text-rose-600 dark:text-rose-400">
                              -{fc.deletions}
                            </span>
                            {fc.churnRatio !== undefined && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                {(fc.churnRatio * 100).toFixed(0)}% churn
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                      No individual file diff records available for this commit.
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (activeCommitDetails.developerId || activeCommitDetails.authorEmail) {
                      setSelectedAuthorId(
                        activeCommitDetails.developerId || activeCommitDetails.authorEmail
                      )
                      setIsDrawerOpen(false)
                      setCurrentPage(1)
                    }
                  }}
                  className="text-xs"
                >
                  <User className="h-3.5 w-3.5 mr-1.5" />
                  Filter by This Author
                </Button>

                {activeCommitDetails.repository?.fullName && (
                  <Button
                    variant="default"
                    size="sm"
                    asChild
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <a
                      href={`https://github.com/${activeCommitDetails.repository.fullName}/commit/${activeCommitDetails.sha}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>Open on GitHub</span>
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
