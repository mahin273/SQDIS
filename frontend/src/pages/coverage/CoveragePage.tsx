import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck,
  Upload,
  FileCode2,
  Loader2,
  AlertCircle,
  Eye,
  Search,
  RefreshCw,
  GitBranch,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { coverageService, repositoriesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatBytes, formatDate, formatNumber } from '@/lib/utils'
import { QueryState, formatScore } from '../pageUtils'
import type { Repository, CoverageReport, CoverageModule } from '@/types'
import { useTheme } from '@/context/ThemeContext'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'

export function CoveragePage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isDarkMode } = useTheme()

  // Selected Repository State
  const [selectedRepoId, setSelectedRepoId] = useState('')

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadRepoId, setUploadRepoId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [branch, setBranch] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Inspection modal state
  const [viewingReportId, setViewingReportId] = useState<string | null>(null)
  const [modalModuleSearch, setModalModuleSearch] = useState('')

  // Explorer search & filter state
  const [fileSearch, setFileSearch] = useState('')
  const [healthFilter, setHealthFilter] = useState<'ALL' | 'HIGH' | 'MODERATE' | 'LOW'>('ALL')
  const [sortBy, setSortBy] = useState<'lowest' | 'highest' | 'lines' | 'path'>('lowest')
  const [copiedSha, setCopiedSha] = useState<string | null>(null)

  // Repositories Query
  const repositoriesQuery = useQuery({
    queryKey: ['repositories', 'connected'],
    queryFn: () => repositoriesService.getConnected(),
  })

  const rawRepos = repositoriesQuery.data ?? []
  const repositories: Repository[] = useMemo(() => {
    const list = Array.isArray(rawRepos) ? rawRepos : (rawRepos as any)?.data ?? []
    return list.filter((r: any) => (r.isActive ?? r.isEnabled ?? false) && !!r.id)
  }, [rawRepos])

  // Auto-select first repository
  useEffect(() => {
    if (!selectedRepoId && repositories.length > 0) {
      setSelectedRepoId(repositories[0].id)
      setUploadRepoId(repositories[0].id)
    }
  }, [selectedRepoId, repositories])

  // Coverage Reports Query
  const coverageQuery = useQuery({
    queryKey: queryKeys.coverage.all({
      repositoryId: selectedRepoId || undefined,
      page: 1,
      limit: 50,
    }),
    queryFn: () =>
      coverageService.getAll({
        repositoryId: selectedRepoId || undefined,
        page: 1,
        limit: 50,
      }),
  })

  // Coverage Trends Query
  const trendsQuery = useQuery({
    queryKey: ['coverage', 'trends', selectedRepoId],
    queryFn: () => coverageService.getTrends(selectedRepoId, { limit: 30 }),
    enabled: !!selectedRepoId,
  })

  // Detailed report query for inspection modal
  const reportDetailQuery = useQuery({
    queryKey: queryKeys.coverage.detail(viewingReportId ?? ''),
    queryFn: () => coverageService.getById(viewingReportId!),
    enabled: !!viewingReportId,
  })

  const handleOpenUpload = () => {
    setUploadError(null)
    setUploadRepoId(selectedRepoId || (repositories[0]?.id ?? ''))
    setIsUploadOpen(true)
  }

  const handleCloseUpload = () => {
    if (isUploading) return
    setIsUploadOpen(false)
    setFile(null)
    setUploadError(null)
    setBranch('')
    setCommitSha('')
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !uploadRepoId) {
      setUploadError('Please select a repository and choose a coverage file.')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      await coverageService.upload(file, uploadRepoId, {
        branch: branch.trim() || undefined,
        commitSha: commitSha.trim() || undefined,
      })

      toast('Coverage report uploaded successfully! Processing started.', { type: 'success' })
      handleCloseUpload()
      coverageQuery.refetch()
      trendsQuery.refetch()
      queryClient.invalidateQueries({ queryKey: ['coverage'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to upload coverage report'
      setUploadError(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRefresh = () => {
    coverageQuery.refetch()
    trendsQuery.refetch()
    repositoriesQuery.refetch()
  }

  const handleCopySha = (sha: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigator.clipboard.writeText(sha)
    setCopiedSha(sha)
    setTimeout(() => {
      setCopiedSha((prev) => (prev === sha ? null : prev))
    }, 2000)
  }

  const rawCoverage = coverageQuery.data
  const reports: CoverageReport[] = Array.isArray(rawCoverage)
    ? rawCoverage
    : rawCoverage?.reports ?? []
  const completed = reports.filter((report) => report.status === 'COMPLETED')
  const latestReport = completed[0] ?? reports[0] ?? null

  const averageCoverage =
    completed.length > 0
      ? completed.reduce((sum, report) => sum + (report.coveragePercentage ?? 0), 0) /
        completed.length
      : 0

  const activeCoveragePct = latestReport?.coveragePercentage ?? averageCoverage
  const activeLinesCovered = latestReport?.linesCovered ?? 0
  const activeLinesTotal = latestReport?.linesTotal ?? 0
  const activeDelta = latestReport?.coverageDelta ?? 0

  // Modules from latest report or viewing report
  const allModules: CoverageModule[] = useMemo(() => {
    if (latestReport?.modules && latestReport.modules.length > 0) {
      return latestReport.modules
    }
    const reportWithMods = completed.find((r) => r.modules && r.modules.length > 0)
    return reportWithMods?.modules ?? []
  }, [latestReport, completed])

  // Module Health Distribution
  const { highCount, moderateCount, lowCount, highPct, modPct, lowPct } = useMemo(() => {
    if (allModules.length === 0) {
      return { highCount: 0, moderateCount: 0, lowCount: 0, highPct: 0, modPct: 0, lowPct: 0 }
    }
    let h = 0
    let m = 0
    let l = 0
    allModules.forEach((mod) => {
      const pct = mod.coveragePercentage ?? 0
      if (pct >= 80) h++
      else if (pct >= 50) m++
      else l++
    })
    const total = allModules.length
    return {
      highCount: h,
      moderateCount: m,
      lowCount: l,
      highPct: Math.round((h / total) * 100),
      modPct: Math.round((m / total) * 100),
      lowPct: Math.round((l / total) * 100),
    }
  }, [allModules])

  // Filtered and Sorted Modules for File Explorer
  const explorerModules = useMemo(() => {
    let result = [...allModules]

    if (healthFilter === 'HIGH') {
      result = result.filter((m) => (m.coveragePercentage ?? 0) >= 80)
    } else if (healthFilter === 'MODERATE') {
      result = result.filter((m) => (m.coveragePercentage ?? 0) >= 50 && (m.coveragePercentage ?? 0) < 80)
    } else if (healthFilter === 'LOW') {
      result = result.filter((m) => (m.coveragePercentage ?? 0) < 50)
    }

    if (fileSearch.trim()) {
      const q = fileSearch.toLowerCase().trim()
      result = result.filter((m) => m.modulePath.toLowerCase().includes(q))
    }

    result.sort((a, b) => {
      if (sortBy === 'lowest') {
        return (a.coveragePercentage ?? 0) - (b.coveragePercentage ?? 0)
      } else if (sortBy === 'highest') {
        return (b.coveragePercentage ?? 0) - (a.coveragePercentage ?? 0)
      } else if (sortBy === 'lines') {
        return (b.linesTotal ?? 0) - (a.linesTotal ?? 0)
      } else {
        return a.modulePath.localeCompare(b.modulePath)
      }
    })

    return result
  }, [allModules, healthFilter, fileSearch, sortBy])

  // Coverage Movement Trend Chart Data
  const trendData = useMemo(() => {
    const rawPoints = trendsQuery.data?.reports
    if (rawPoints && rawPoints.length > 0) {
      return rawPoints.map((p) => {
        const d = p.createdAt ? new Date(p.createdAt) : null
        const label =
          d && !isNaN(d.getTime())
            ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : p.createdAt
        return {
          date: label,
          coverage: p.coveragePercentage ?? 0,
          delta: p.coverageDelta ?? 0,
          sha: p.commitSha ? p.commitSha.slice(0, 7) : '',
          branch: p.branch ?? 'main',
        }
      })
    }

    // Fallback to chronological completed reports from query
    if (completed.length > 0) {
      return [...completed]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((r) => {
          const d = r.createdAt ? new Date(r.createdAt) : null
          const label =
            d && !isNaN(d.getTime())
              ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : r.createdAt
          return {
            date: label,
            coverage: r.coveragePercentage ?? 0,
            delta: r.coverageDelta ?? 0,
            sha: r.commitSha ? r.commitSha.slice(0, 7) : '',
            branch: r.branch ?? 'main',
          }
        })
    }

    return []
  }, [trendsQuery.data?.reports, completed])

  const trendStats = trendsQuery.data?.statistics

  // Active viewing report in inspection modal
  const viewingReport =
    reportDetailQuery.data ?? reports.find((r) => r.id === viewingReportId) ?? null

  // Filtered module list for the inspection modal
  const filteredModalModules = useMemo(() => {
    if (!viewingReport?.modules) return []
    if (!modalModuleSearch.trim()) return viewingReport.modules
    const q = modalModuleSearch.toLowerCase()
    return viewingReport.modules.filter((m) => m.modulePath.toLowerCase().includes(q))
  }, [viewingReport?.modules, modalModuleSearch])

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Clean Top Header Toolbar (No Bulky Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Code Coverage & Quality
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30"
                >
                  Live CI Telemetry
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Track line execution ratios, regression health, and codebase test movement across builds.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {repositories.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
              <GitBranch className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                {repositories.map((repo) => (
                  <option
                    key={repo.id}
                    value={repo.id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {repo.fullName || repo.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={coverageQuery.isFetching || trendsQuery.isFetching}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-slate-500 ${
                coverageQuery.isFetching || trendsQuery.isFetching ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenUpload}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Report</span>
          </Button>
        </div>
      </div>

      {/* 4-Card Executive KPI Strip */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Overall Line Coverage */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Codebase Line Coverage
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatScore(activeCoveragePct)}%
                </span>
                <span
                  className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    activeCoveragePct >= 80
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : activeCoveragePct >= 50
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {activeCoveragePct >= 80 ? 'Healthy' : activeCoveragePct >= 50 ? 'Moderate' : 'At Risk'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Target benchmark: 80.0%
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Lines Covered Ratio */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Instrumented Lines
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatNumber(activeLinesCovered)}
                </span>
                <span className="text-sm font-medium text-slate-400">
                  / {formatNumber(activeLinesTotal)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {activeLinesTotal > 0
                  ? `${formatScore((activeLinesCovered / activeLinesTotal) * 100)}% execution rate`
                  : 'Total lines tracked'}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
              <FileCode2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Coverage Movement Delta */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Coverage Movement
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    activeDelta > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : activeDelta < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {activeDelta > 0 ? `+${activeDelta.toFixed(1)}%` : `${activeDelta.toFixed(1)}%`}
                </span>
                {activeDelta > 0 ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center">
                    <TrendingUp className="h-3.5 w-3.5 mr-0.5" /> Up
                  </span>
                ) : activeDelta < 0 ? (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center">
                    <TrendingDown className="h-3.5 w-3.5 mr-0.5" /> Down
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400 flex items-center">
                    <Minus className="h-3.5 w-3.5 mr-0.5" /> Stable
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                vs previous build ({formatScore(latestReport?.previousCoveragePercentage ?? activeCoveragePct)}%)
              </p>
            </div>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-3 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Monitored Source Modules */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Monitored Source Files
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {allModules.length} files
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{highCount}</span> meet 80% benchmark
              </p>
            </div>
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/60 p-3 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics & Health Distribution Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Coverage Movement Trend Chart */}
        <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Coverage Movement Trend
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Line coverage trajectory across recent builds and branches
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {trendStats?.trend && (
                <Badge
                  variant={trendStats.trend === 'improving' ? 'success' : trendStats.trend === 'declining' ? 'destructive' : 'secondary'}
                  className="text-xs font-medium uppercase tracking-wider"
                >
                  Trend: {trendStats.trend}
                </Badge>
              )}
              {trendStats && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Min: {trendStats.min}% &bull; Max: {trendStats.max}% &bull; Avg: {trendStats.average}%
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCoverage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={isDarkMode ? '#1e293b' : '#f1f5f9'}
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: isDarkMode ? '#64748b' : '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis
                      domain={[50, 100]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: isDarkMode ? '#64748b' : '#94a3b8' }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                        borderRadius: '10px',
                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                        padding: '8px 12px',
                      }}
                      labelStyle={{
                        color: isDarkMode ? '#cbd5e1' : '#475569',
                        fontWeight: 600,
                        marginBottom: '4px',
                      }}
                      formatter={(value: any, _name: any, item: any) => [
                        `${value}% (${item.payload.delta >= 0 ? '+' : ''}${item.payload.delta}%)`,
                        `Coverage [${item.payload.sha || 'build'}]`,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="coverage"
                      name="Coverage"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorCoverage)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <ShieldCheck className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm">No coverage trend recorded yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module Health Breakdown */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Module Health Distribution
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Categorized across {allModules.length} instrumented source files
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* High Tier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  High Coverage (&ge; 80%)
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                  {highCount} files ({highPct}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${highPct}%` }}
                />
              </div>
            </div>

            {/* Moderate Tier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Moderate (50% - 79%)
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                  {moderateCount} files ({modPct}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${modPct}%` }}
                />
              </div>
            </div>

            {/* Low / Critical Tier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  At Risk (&lt; 50%)
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                  {lowCount} files ({lowPct}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${lowPct}%` }}
                />
              </div>
            </div>

            {/* Quality Note */}
            <div className="pt-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  {lowCount > 0
                    ? `${lowCount} source files have coverage below 50% and should be prioritized for regression test writing.`
                    : 'All monitored source files maintain adequate regression test coverage.'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Source File Coverage Explorer */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Source File Coverage Explorer
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect file-level line coverage from latest build{' '}
                {latestReport?.commitSha && (
                  <code className="text-slate-700 dark:text-slate-300 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {latestReport.commitSha.slice(0, 7)}
                  </code>
                )}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <Input
                  placeholder="Filter files by name or path..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  leftIcon={<Search className="h-3.5 w-3.5 text-slate-400" />}
                  className="h-8 text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="lowest">Lowest Coverage First</option>
                <option value="highest">Highest Coverage First</option>
                <option value="lines">Most Lines Total</option>
                <option value="path">File Path (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <Tabs value={healthFilter} onValueChange={(v) => setHealthFilter(v as any)}>
              <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1">
                <TabsTrigger value="ALL" className="text-xs">
                  All Files ({allModules.length})
                </TabsTrigger>
                <TabsTrigger value="HIGH" className="text-xs">
                  Healthy &ge;80% ({highCount})
                </TabsTrigger>
                <TabsTrigger value="MODERATE" className="text-xs">
                  Moderate 50-79% ({moderateCount})
                </TabsTrigger>
                <TabsTrigger value="LOW" className="text-xs">
                  At Risk &lt;50% ({lowCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {explorerModules.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <FileCode2 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium">No source files match current criteria</p>
              <p className="text-xs text-slate-400 mt-1">
                Try adjusting search keywords or selecting another filter tab.
              </p>
            </div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
              {explorerModules.map((mod, idx) => {
                const pct = mod.coveragePercentage ?? 0
                const badgeStyle =
                  pct >= 80
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                    : pct >= 50
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'

                const progressColor =
                  pct >= 80
                    ? 'bg-emerald-500'
                    : pct >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'

                return (
                  <div
                    key={mod.id || idx}
                    className="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 -mx-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-4 w-4 text-slate-400 shrink-0" />
                        <span
                          className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate font-mono"
                          title={mod.modulePath}
                        >
                          {mod.modulePath}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${progressColor}`}
                            style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                          {mod.linesCovered} / {mod.linesTotal} lines
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <Badge variant="outline" className={`text-xs font-mono font-bold ${badgeStyle}`}>
                        {formatScore(pct)}%
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage Build History & Ingestion Feed */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Coverage Build History
          </CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit log of uploaded and parsed coverage files for repository {repositories.find(r => r.id === selectedRepoId)?.fullName || 'SQDIS'}
          </p>
        </CardHeader>

        <CardContent className="pt-4">
          <QueryState
            isLoading={coverageQuery.isLoading}
            error={coverageQuery.error}
            onRetry={() => coverageQuery.refetch()}
          >
            {reports.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <ShieldCheck className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  No coverage reports found
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Upload an LCOV (.info), Cobertura (.xml), JaCoCo (.xml), or NYC JSON report to start tracking test coverage.
                </p>
                <Button
                  onClick={handleOpenUpload}
                  className="mt-4 rounded-xl text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Coverage Report</span>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {reports.map((report) => {
                  const pct = report.coveragePercentage ?? 0
                  const isLatest = report.id === latestReport?.id
                  const delta = report.coverageDelta ?? 0

                  return (
                    <div
                      key={report.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 px-3 -mx-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                            {report.repository?.fullName || report.originalFilename}
                          </h3>
                          <Badge
                            variant={
                              report.status === 'COMPLETED'
                                ? 'success'
                                : report.status === 'FAILED'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-[11px] font-semibold"
                          >
                            {report.status}
                          </Badge>
                          {isLatest && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30"
                            >
                              Current Active
                            </Badge>
                          )}
                          {report.branch && (
                            <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              <GitBranch className="h-2.5 w-2.5 mr-1" />
                              {report.branch}
                            </span>
                          )}
                          {report.commitSha && (
                            <button
                              type="button"
                              onClick={(e) => handleCopySha(report.commitSha!, e)}
                              className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                              title="Click to copy commit SHA"
                            >
                              {copiedSha === report.commitSha ? (
                                <Check className="h-2.5 w-2.5 mr-1 text-emerald-500" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 mr-1" />
                              )}
                              {report.commitSha.slice(0, 7)}
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Format: <strong>{report.format}</strong>
                          </span>
                          <span>Size: {formatBytes(report.fileSize)}</span>
                          <span>
                            {report.linesCovered !== null && report.linesTotal !== null ? (
                              <>
                                Lines: <strong>{formatNumber(report.linesCovered ?? 0)}</strong> /{' '}
                                {formatNumber(report.linesTotal ?? 0)}
                              </>
                            ) : null}
                          </span>
                          <span>
                            Date:{' '}
                            {report.createdAt
                              ? formatDate(report.createdAt)
                              : 'Recently'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold font-mono ${
                              pct >= 80
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : pct >= 50
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatScore(pct)}%
                          </span>
                          {delta !== 0 && (
                            <span
                              className={`text-[11px] font-mono font-medium ${
                                delta > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              ({delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`})
                            </span>
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingReportId(report.id)}
                          className="h-7 px-2.5 text-[11px] font-medium gap-1 cursor-pointer text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Inspect Report</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      {/* Report Inspection Modal */}
      <Modal
        isOpen={!!viewingReportId}
        onClose={() => {
          setViewingReportId(null)
          setModalModuleSearch('')
        }}
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <span>Coverage Report Details</span>
          </div>
        }
        description={
          viewingReport?.repository?.fullName
            ? `Detailed file breakdown for ${viewingReport.repository.fullName} (${viewingReport.originalFilename})`
            : viewingReport?.originalFilename
        }
        size="lg"
        footer={
          <div className="flex justify-between items-center w-full">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {filteredModalModules.length} file{filteredModalModules.length === 1 ? '' : 's'} displayed
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setViewingReportId(null)
                setModalModuleSearch('')
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        {reportDetailQuery.isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-2" />
            <p className="text-sm text-slate-500">Loading report breakdown...</p>
          </div>
        ) : viewingReport ? (
          <div className="space-y-5">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Coverage</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {formatScore(viewingReport.coveragePercentage ?? 0)}%
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Lines Covered</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNumber(viewingReport.linesCovered ?? 0)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Lines</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatNumber(viewingReport.linesTotal ?? 0)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Format</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                  {viewingReport.format}
                </p>
              </div>
            </div>

            {/* Metadata strip */}
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span>
                <strong>File:</strong> {viewingReport.originalFilename}
              </span>
              <span>
                <strong>Size:</strong> {formatBytes(viewingReport.fileSize)}
              </span>
              {viewingReport.branch && (
                <span>
                  <strong>Branch:</strong> {viewingReport.branch}
                </span>
              )}
              {viewingReport.commitSha && (
                <span>
                  <strong>Commit:</strong>{' '}
                  <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                    {viewingReport.commitSha.slice(0, 7)}
                  </code>
                </span>
              )}
              <span>
                <strong>Uploaded:</strong> {formatDate(viewingReport.createdAt)}
              </span>
            </div>

            {/* Search and Module Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  File Breakdown ({viewingReport.modules?.length ?? 0} files)
                </h4>
                <div className="relative w-48 sm:w-64">
                  <Input
                    placeholder="Filter files..."
                    value={modalModuleSearch}
                    onChange={(e) => setModalModuleSearch(e.target.value)}
                    leftIcon={<Search className="h-3.5 w-3.5" />}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {filteredModalModules.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  {viewingReport.modules && viewingReport.modules.length > 0
                    ? 'No files matching search criteria.'
                    : 'No file-level breakdown available in this report.'}
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                  {filteredModalModules.map((mod, idx) => {
                    const pct = mod.coveragePercentage ?? 0
                    const badgeClass =
                      pct >= 80
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : pct >= 50
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'

                    return (
                      <div
                        key={mod.id || idx}
                        className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileCode2 className="h-4 w-4 text-slate-400 shrink-0" />
                            <p
                              className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate font-mono"
                              title={mod.modulePath}
                            >
                              {mod.modulePath}
                            </p>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                              {mod.linesCovered} / {mod.linesTotal} lines
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold shrink-0 font-mono ${badgeClass}`}
                        >
                          {formatScore(pct)}%
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">Report not found.</div>
        )}
      </Modal>

      {/* Upload Coverage Report Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={handleCloseUpload}
        title="Upload Coverage Report"
        description="Upload an automated test coverage report (LCOV, Cobertura XML, JaCoCo XML, or NYC JSON)."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseUpload} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || !uploadRepoId || isUploading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1.5" />
                  <span>Upload Report</span>
                </>
              )}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUpload} className="space-y-4">
          {uploadError && (
            <div className="flex items-start gap-2 p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Repository *
            </label>
            <select
              value={uploadRepoId}
              onChange={(e) => setUploadRepoId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Select a repository</option>
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.fullName || repo.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Coverage Report File *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".info,.xml,.json,.txt"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setFile(e.target.files[0])
                  setUploadError(null)
                }
              }}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900/40"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  <FileCode2 className="h-5 w-5" />
                  <span className="truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-slate-400">({formatBytes(file.size)})</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Click to browse or drop coverage file
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports LCOV (.info), Cobertura (.xml), JaCoCo (.xml), NYC (.json) up to 50MB
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Branch (optional)"
                placeholder="e.g. main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Commit SHA (optional)"
                placeholder="e.g. 0704c80"
                value={commitSha}
                onChange={(e) => setCommitSha(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default CoveragePage
