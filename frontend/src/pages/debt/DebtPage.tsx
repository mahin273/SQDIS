import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Code2,
  AlertTriangle,
  ShieldAlert,
  Flame,
  Search,
  Clock,
  Activity,
  Download,
  CheckCircle2,
  GitBranch,
  RefreshCw,
  Copy,
  Check,
  FileCode2,
  Layers,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  UserCheck,
  CheckSquare,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Pagination } from '@/components/ui/pagination'
import { Avatar } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/toast'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { debtService, repositoriesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatDate } from '@/lib/utils'
import { QueryState } from '../pageUtils'
import type {
  DebtItem,
  DebtMarkerType,
  DebtHotspot,
  DebtRecommendation,
  DebtAttribution,
  ModuleDebtScore,
} from '@/types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'

export function DebtPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<'inventory' | 'hotspots' | 'modules'>('inventory')
  const [selectedRepoId, setSelectedRepoId] = useState<string>('ALL')
  const [markerFilter, setMarkerFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'RESOLVED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Slide-Over Drawer State
  const [selectedItem, setSelectedItem] = useState<DebtItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Repositories Query
  const repositoriesQuery = useQuery({
    queryKey: ['repositories', 'connected'],
    queryFn: () => repositoriesService.getConnected(),
  })
  const repositories = repositoriesQuery.data ?? []

  // Main Debt Inventory Query
  const debtQuery = useQuery({
    queryKey: queryKeys.debt.all({
      page,
      pageSize,
      repositoryId: selectedRepoId !== 'ALL' ? selectedRepoId : undefined,
      markerType: markerFilter !== 'ALL' ? (markerFilter as DebtMarkerType) : undefined,
      isResolved:
        statusFilter === 'RESOLVED' ? true : statusFilter === 'UNRESOLVED' ? false : undefined,
    }),
    queryFn: () =>
      debtService.getAll({
        page,
        pageSize,
        repositoryId: selectedRepoId !== 'ALL' ? selectedRepoId : undefined,
        markerType: markerFilter !== 'ALL' ? (markerFilter as DebtMarkerType) : undefined,
        isResolved:
          statusFilter === 'RESOLVED' ? true : statusFilter === 'UNRESOLVED' ? false : undefined,
      }),
  })

  // Hotspots Query
  const hotspotsQuery = useQuery({
    queryKey: queryKeys.debt.hotspots(selectedRepoId !== 'ALL' ? selectedRepoId : undefined),
    queryFn: () =>
      debtService.getHotspots(selectedRepoId !== 'ALL' ? selectedRepoId : undefined),
  })

  // Debt Trends Query
  const trendsQuery = useQuery({
    queryKey: queryKeys.debt.trends({
      days: 30,
      repositoryId: selectedRepoId !== 'ALL' ? selectedRepoId : undefined,
    }),
    queryFn: () =>
      debtService.getTrends(
        30,
        selectedRepoId !== 'ALL' ? selectedRepoId : undefined,
      ),
  })

  // Recommendations Query
  const recommendationsQuery = useQuery({
    queryKey: queryKeys.debt.recommendations({
      repositoryId: selectedRepoId !== 'ALL' ? selectedRepoId : undefined,
      limit: 10,
    }),
    queryFn: () =>
      debtService.getRecommendations(
        selectedRepoId !== 'ALL' ? selectedRepoId : undefined,
        10,
      ),
  })

  // Developer Attribution Query
  const attributionQuery = useQuery({
    queryKey: queryKeys.debt.attribution,
    queryFn: () => debtService.getAttribution(),
  })

  // Module Debt Scores Query
  const moduleScoresQuery = useQuery({
    queryKey: queryKeys.debt.modules({
      repositoryId: selectedRepoId !== 'ALL' ? selectedRepoId : undefined,
      threshold: 0,
    }),
    queryFn: () =>
      debtService.getModuleScores(
        selectedRepoId !== 'ALL' ? selectedRepoId : undefined,
        0,
      ),
  })

  // Resolve Debt Item Mutation
  const resolveMutation = useMutation({
    mutationFn: (id: string) => debtService.resolve(id),
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({ queryKey: ['debt'] })
      toast('Debt Item Resolved', {
        type: 'success',
        description: `Marker at ${updatedItem.filePath}:${updatedItem.lineNumber} marked as resolved.`,
      })
      if (selectedItem?.id === updatedItem.id) {
        setSelectedItem(updatedItem)
      }
    },
    onError: (err: any) => {
      toast('Action Failed', {
        type: 'error',
        description: err?.response?.data?.message || 'Could not resolve debt item.',
      })
    },
  })

  // Data Normalization
  const responseData = debtQuery.data
  const items: DebtItem[] = Array.isArray(responseData)
    ? responseData
    : responseData && typeof responseData === 'object' && Array.isArray((responseData as any).data)
    ? (responseData as any).data
    : []

  const totalDebtCount = responseData?.total ?? items.length

  const hotspots: DebtHotspot[] = Array.isArray(hotspotsQuery.data)
    ? hotspotsQuery.data
    : (hotspotsQuery.data as any)?.data ?? []

  const recommendations: DebtRecommendation[] = Array.isArray(recommendationsQuery.data)
    ? recommendationsQuery.data
    : (recommendationsQuery.data as any)?.data ?? []

  const attributions: DebtAttribution[] = Array.isArray(attributionQuery.data)
    ? attributionQuery.data
    : (attributionQuery.data as any)?.data ?? []

  const moduleScores: ModuleDebtScore[] = Array.isArray(moduleScoresQuery.data)
    ? moduleScoresQuery.data
    : (moduleScoresQuery.data as any)?.data ?? []

  // Trend Data for AreaChart
  const trendData = useMemo(() => {
    const rawData = trendsQuery.data
    const points = Array.isArray(rawData?.points)
      ? rawData.points
      : Array.isArray(rawData?.data)
      ? rawData.data
      : []

    if (!points || points.length === 0) return []

    return points.map((p: any) => {
      const d = new Date(p.date)
      return {
        date: isNaN(d.getTime())
          ? p.date || ''
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        debt: Number(p.totalDebt ?? p.debt ?? p.netDebt ?? 0),
        added: Number(p.addedDebt ?? p.newDebt ?? 0),
        resolved: Number(p.resolvedDebt ?? 0),
      }
    })
  }, [trendsQuery.data])

  // Filtered Items (Client-side Search)
  const filteredItems = useMemo(() => {
    let result = items
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase().trim()
      result = result.filter(
        (i) =>
          i.content?.toLowerCase().includes(lower) ||
          i.filePath?.toLowerCase().includes(lower) ||
          i.author?.name?.toLowerCase().includes(lower) ||
          i.markerType?.toLowerCase().includes(lower)
      )
    }
    return result
  }, [items, searchQuery])

  // Marker Breakdown Counts
  const markerCounts = useMemo(() => {
    let todo = 0
    let fixme = 0
    let hack = 0
    let xxx = 0
    items.forEach((item) => {
      if (item.markerType === 'TODO') todo++
      else if (item.markerType === 'FIXME') fixme++
      else if (item.markerType === 'HACK') hack++
      else if (item.markerType === 'XXX') xxx++
    })
    return { todo, fixme, hack, xxx }
  }, [items])

  // Critical/High markers: FIXME + HACK
  const highRiskCount = markerCounts.fixme + markerCounts.hack

  // Estimated Effort Calculation: HACK=3h, FIXME=2h, TODO=0.5h, XXX=1.5h
  const estimatedEffortHours = useMemo(() => {
    const hours =
      markerCounts.hack * 3 +
      markerCounts.fixme * 2 +
      markerCounts.todo * 0.5 +
      markerCounts.xxx * 1.5
    return Math.round(hours * 10) / 10
  }, [markerCounts])

  // Velocity calculation from trend data
  const velocity = useMemo(() => {
    if (typeof trendsQuery.data?.velocity === 'number') {
      return trendsQuery.data.velocity
    }
    return 0
  }, [trendsQuery.data])

  // Handle Copy to Clipboard
  const handleCopy = (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => {
      setCopiedText((prev) => (prev === text ? null : prev))
    }, 2000)
  }

  // Handle Refresh
  const handleRefresh = () => {
    debtQuery.refetch()
    hotspotsQuery.refetch()
    trendsQuery.refetch()
    recommendationsQuery.refetch()
    attributionQuery.refetch()
    moduleScoresQuery.refetch()
  }

  // Export CSV Report
  const handleExportCSV = () => {
    if (items.length === 0) return
    const headers = ['ID', 'Marker Type', 'File Path', 'Line Number', 'Content', 'Author', 'Status', 'Created At']
    const rows = items.map((i) => [
      i.id,
      i.markerType,
      i.filePath,
      i.lineNumber,
      `"${(i.content || '').replace(/"/g, '""')}"`,
      `"${i.author?.name || 'Unassigned'}"`,
      i.isResolved ? 'Resolved' : 'Open',
      i.createdAt,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `technical-debt-report-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Marker Type Badge Helper
  const getMarkerBadge = (markerType: DebtMarkerType | string) => {
    switch (markerType) {
      case 'FIXME':
        return (
          <Badge
            variant="outline"
            className="text-[11px] font-mono font-semibold tracking-wider uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"
          >
            <AlertTriangle className="h-3 w-3" /> FIXME
          </Badge>
        )
      case 'HACK':
        return (
          <Badge
            variant="outline"
            className="text-[11px] font-mono font-semibold tracking-wider uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1"
          >
            <ShieldAlert className="h-3 w-3" /> HACK
          </Badge>
        )
      case 'XXX':
        return (
          <Badge
            variant="outline"
            className="text-[11px] font-mono font-semibold tracking-wider uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1"
          >
            <Flame className="h-3 w-3" /> XXX
          </Badge>
        )
      case 'TODO':
      default:
        return (
          <Badge
            variant="outline"
            className="text-[11px] font-mono font-semibold tracking-wider uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1"
          >
            <Code2 className="h-3 w-3" /> TODO
          </Badge>
        )
    }
  }

  // Hotspot Severity Badge Helper
  const getHotspotSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-semibold">
            Critical
          </Badge>
        )
      case 'HIGH':
        return (
          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px] font-semibold">
            High Risk
          </Badge>
        )
      case 'MEDIUM':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold">
            Medium
          </Badge>
        )
      default:
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
            Low
          </Badge>
        )
    }
  }

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Sleek Minimalist Top Toolbar (No Bulky Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Technical Debt & Architectural Hotspots
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  Code Scanner Active
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Track code markers (TODO, FIXME, HACK, XXX), refactoring hotspots, and maintainability trajectory.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Repository Selector */}
          {repositories.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
              <GitBranch className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <select
                value={selectedRepoId}
                onChange={(e) => {
                  setSelectedRepoId(e.target.value)
                  setPage(1)
                }}
                className="bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  All Repositories
                </option>
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

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={debtQuery.isFetching || hotspotsQuery.isFetching}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-slate-500 ${
                debtQuery.isFetching || hotspotsQuery.isFetching ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </Button>

          {/* Export Report Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
          >
            <Download className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* 4-Card Executive KPI Strip */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Debt Inventory */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Debt Inventory
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {totalDebtCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">items</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                <span className="text-blue-600 dark:text-blue-400">{markerCounts.todo} TODO</span>
                <span>·</span>
                <span className="text-amber-600 dark:text-amber-400">{markerCounts.fixme} FIXME</span>
                <span>·</span>
                <span className="text-rose-600 dark:text-rose-400">{markerCounts.hack} HACK</span>
                <span>·</span>
                <span className="text-purple-600 dark:text-purple-400">{markerCounts.xxx} XXX</span>
              </div>
            </div>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-3 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <FileCode2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: High Risk / Critical Markers */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                High Risk Markers
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {highRiskCount}
                </span>
                <span
                  className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    highRiskCount > 0
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {highRiskCount > 0 ? 'Needs Attention' : 'Clean'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {markerCounts.fixme} defect fixes and {markerCounts.hack} temporary hacks
              </p>
            </div>
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Active Refactoring Hotspots */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Refactoring Hotspots
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {hotspots.length}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">modules</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                High churn correlated with defect frequency
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <Flame className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Est. Remediation Effort */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Est. Remediation Effort
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {estimatedEffortHours}h
                </span>
                <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {velocity <= 0 ? (
                    <>
                      <TrendingDown className="h-3 w-3 mr-1 text-emerald-500" />
                      Paying Down
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3 w-3 mr-1 text-rose-500" />
                      +{velocity.toFixed(2)}/day
                    </>
                  )}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Weighted by marker complexity
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'inventory' | 'hotspots' | 'modules')}
        className="w-full space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <TabsTrigger
              value="inventory"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              Debt Inventory
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-slate-200 dark:bg-slate-700">
                {totalDebtCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="hotspots"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              Hotspots & Recommendations
              {hotspots.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {hotspots.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="modules"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              Modules & Attribution
              {attributions.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {attributions.length} devs
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Quick Stats or Velocity Pill */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Formula: HACK (3x) · FIXME (2x) · TODO (1x) · XXX (2x)
            </span>
          </div>
        </div>

        {/* TAB 1: DEBT INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Search Input */}
                  <div className="w-full lg:w-96">
                    <Input
                      placeholder="Search markers, file paths, authors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      leftIcon={<Search className="h-4 w-4 text-slate-400" />}
                      className="h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                  </div>

                  {/* Marker Type Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
                      Marker:
                    </span>
                    {(['ALL', 'TODO', 'FIXME', 'HACK', 'XXX'] as const).map((marker) => (
                      <button
                        key={marker}
                        onClick={() => {
                          setMarkerFilter(marker)
                          setPage(1)
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          markerFilter === marker
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {marker === 'ALL' ? 'All Markers' : marker}
                      </button>
                    ))}

                    <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>

                    {/* Status Filter */}
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
                      Status:
                    </span>
                    {(['ALL', 'UNRESOLVED', 'RESOLVED'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status)
                          setPage(1)
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          statusFilter === status
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {status === 'ALL' ? 'All' : status === 'UNRESOLVED' ? 'Open' : 'Resolved'}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory List */}
            <QueryState
              isLoading={debtQuery.isLoading}
              error={debtQuery.error}
              onRetry={() => debtQuery.refetch()}
            >
              <div className="space-y-3">
                {filteredItems.map((item: DebtItem) => {
                  const effortHours =
                    item.markerType === 'HACK'
                      ? '3.0h'
                      : item.markerType === 'FIXME'
                      ? '2.0h'
                      : item.markerType === 'XXX'
                      ? '1.5h'
                      : '0.5h'

                  return (
                    <Card
                      key={item.id}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-sm transition-all group"
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          {/* Left Column: Marker & Snippet */}
                          <div className="flex-1 min-w-0 space-y-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getMarkerBadge(item.markerType)}
                              {item.isResolved ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Resolved
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                >
                                  Open
                                </Badge>
                              )}
                              {item.repository && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                                  {item.repository.name}
                                </span>
                              )}
                            </div>

                            {/* Code Snippet Box */}
                            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto flex items-start justify-between gap-3 group/snippet">
                              <div className="flex items-start gap-2 min-w-0">
                                <span className="text-slate-400 select-none">//</span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400 select-none">
                                  {item.markerType}:
                                </span>
                                <span className="text-slate-700 dark:text-slate-300 break-words">
                                  {item.content}
                                </span>
                              </div>
                              <button
                                onClick={(e) => handleCopy(`// ${item.markerType}: ${item.content}`, e)}
                                title="Copy comment"
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 p-1"
                              >
                                {copiedText === `// ${item.markerType}: ${item.content}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 opacity-60 group-hover/snippet:opacity-100" />
                                )}
                              </button>
                            </div>

                            {/* File Location & Metadata Row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <div
                                onClick={(e) => handleCopy(`${item.filePath}:${item.lineNumber}`, e)}
                                title="Click to copy file location"
                                className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded-md transition-colors"
                              >
                                <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[280px] sm:max-w-md">
                                  {item.filePath}:{item.lineNumber}
                                </span>
                                {copiedText === `${item.filePath}:${item.lineNumber}` ? (
                                  <Check className="h-3 w-3 text-emerald-500 shrink-0 ml-0.5" />
                                ) : (
                                  <Copy className="h-3 w-3 text-slate-400 shrink-0 ml-0.5 opacity-50 hover:opacity-100" />
                                )}
                              </div>

                              {/* Author Attribution */}
                              {item.author && (
                                <div className="flex items-center gap-1.5">
                                  <Avatar
                                    src={item.author.avatarUrl}
                                    name={item.author.name}
                                    size="sm"
                                    className="h-4 w-4 text-[9px]"
                                  />
                                  <span>{item.author.name}</span>
                                </div>
                              )}

                              {/* Created At */}
                              <div className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                <span>{formatDate(item.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Actions & Effort */}
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between shrink-0 gap-3">
                            <div className="text-right">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Est. {effortHours}
                              </span>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                                Remediation
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {!item.isResolved && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => resolveMutation.mutate(item.id)}
                                  disabled={resolveMutation.isPending}
                                  title="Mark debt marker as resolved"
                                  className="h-7 px-2 text-[11px] gap-1 rounded-lg border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                >
                                  <CheckSquare className="h-3 w-3" />
                                  <span>Resolve</span>
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedItem(item)
                                  setIsDrawerOpen(true)
                                }}
                                className="h-7 px-2.5 text-[11px] gap-1 rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <span>Inspect</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {/* Empty State */}
                {filteredItems.length === 0 && (
                  <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-12 text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      No Debt Markers Found
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      {searchQuery
                        ? `No items matching "${searchQuery}". Try adjusting your filters.`
                        : 'No technical debt markers match the selected repository or status filter.'}
                    </p>
                  </Card>
                )}
              </div>

              {/* Pagination */}
              {responseData && (responseData.totalPages > 1 || totalDebtCount > pageSize) && (
                <div className="pt-2">
                  <Pagination
                    currentPage={page}
                    totalPages={
                      responseData.totalPages || Math.ceil(totalDebtCount / pageSize) || 1
                    }
                    onPageChange={setPage}
                  />
                </div>
              )}
            </QueryState>

            {/* 30-Day Debt Accumulation Trajectory Chart */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm mt-8">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-rose-500" />
                      Debt Accumulation Trajectory (30 Days)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Net technical debt evolution and daily resolution velocity
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Current Velocity:</span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-mono ${
                        velocity <= 0
                          ? 'text-emerald-600 border-emerald-300 dark:border-emerald-800'
                          : 'text-rose-600 border-rose-300 dark:border-rose-800'
                      }`}
                    >
                      {velocity <= 0 ? 'Negative (Improving)' : `+${velocity.toFixed(2)}/day`}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[220px] w-full">
                  {trendsQuery.isLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      Loading trend trajectory...
                    </div>
                  ) : trendData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Zero Debt Backlog
                      </p>
                      <p className="text-[11px] text-slate-500">
                        No technical debt accumulation detected in the selected period.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trendData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorDebtTraj" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#334155"
                          opacity={0.2}
                        />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          allowDecimals={false}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            color: '#f8fafc',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="debt"
                          name="Debt Items"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorDebtTraj)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: HOTSPOTS & RECOMMENDATIONS */}
        {activeTab === 'hotspots' && (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Left Column: Refactoring Hotspots */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                      <Flame className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Refactoring Hotspots</CardTitle>
                      <CardDescription className="text-xs">
                        Files with high churn ratio and defect correlation
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {hotspots.length} flagged
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {hotspots.map((hotspot) => {
                    const churnPct = Math.round((hotspot.churnRatio || hotspot.churn || 0) * 100)
                    return (
                      <div
                        key={`${hotspot.repositoryId}-${hotspot.filePath}`}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate"
                              title={hotspot.filePath}
                            >
                              {hotspot.filePath}
                            </p>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {hotspot.repositoryName}
                            </span>
                          </div>
                          {getHotspotSeverityBadge(hotspot.severity)}
                        </div>

                        <div className="grid grid-cols-3 gap-2 my-2.5 text-center bg-slate-50 dark:bg-slate-950 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 tracking-wider">
                              Churn
                            </span>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {churnPct}%
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 tracking-wider">
                              Bug Fixes
                            </span>
                            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                              {hotspot.bugCount}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 tracking-wider">
                              Debt Items
                            </span>
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                              {hotspot.debtCount || 0}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Churn Risk Metric</span>
                            <span>{churnPct}%</span>
                          </div>
                          <Progress
                            value={churnPct}
                            className="h-1.5"
                            indicatorClassName={
                              churnPct > 70
                                ? 'bg-rose-500'
                                : churnPct > 40
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }
                          />
                        </div>
                      </div>
                    )
                  })}

                  {hotspots.length === 0 && (
                    <div className="py-12 px-6 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        No Active Hotspots Flagged
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        No files currently exceed both the code churn threshold and bug correlation limit.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Prioritized Recommendations */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Remediation Recommendations</CardTitle>
                      <CardDescription className="text-xs">
                        Ranked by refactoring ROI (Impact vs Effort)
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    Top {recommendations.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recommendations.map((rec, index) => {
                    const priorityScore =
                      typeof rec.priority === 'number'
                        ? rec.priority.toFixed(1)
                        : rec.priority || 'NORMAL'

                    return (
                      <div
                        key={rec.id || `rec-${index}`}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                              #{index + 1}
                            </span>
                            <p
                              className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[240px] sm:max-w-xs"
                              title={rec.filePath}
                            >
                              {rec.filePath}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                          >
                            ROI: {priorityScore}x
                          </Badge>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2.5 leading-relaxed">
                          {rec.rationale ||
                            rec.description ||
                            'High debt density in this module causes maintenance overhead and defect propagation.'}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                            {rec.markerCount || 0} markers
                          </span>
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                            Impact: {typeof rec.impact === 'number' ? rec.impact.toFixed(1) : 'Medium'}
                          </span>
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                            Effort: {typeof rec.effort === 'number' ? rec.effort.toFixed(1) : 'Low'}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {recommendations.length === 0 && (
                    <div className="py-12 px-6 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        No Urgent Recommendations
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        All modules are currently within acceptable maintainability thresholds.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: MODULES & TEAM ATTRIBUTION */}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            {/* Module Debt Scores Section */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-indigo-500" />
                      Module & Directory Debt Scores
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Directory-level debt aggregation based on weighted marker density
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {moduleScores.length} directories analyzed
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {moduleScores.map((mod, idx) => (
                    <div
                      key={`${mod.repositoryId}-${mod.modulePath}-${idx}`}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate flex-1"
                          title={mod.modulePath}
                        >
                          {mod.modulePath || '/ (Root)'}
                        </p>
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                            mod.score >= 10
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : mod.score >= 5
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          Score: {mod.score}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        <span className="text-blue-600 dark:text-blue-400">
                          {mod.todoCount || 0} TODO
                        </span>
                        <span>·</span>
                        <span className="text-amber-600 dark:text-amber-400">
                          {mod.fixmeCount || 0} FIXME
                        </span>
                        <span>·</span>
                        <span className="text-rose-600 dark:text-rose-400">
                          {mod.hackCount || 0} HACK
                        </span>
                        <span>·</span>
                        <span className="text-purple-600 dark:text-purple-400">
                          {mod.xxxCount || 0} XXX
                        </span>
                      </div>
                    </div>
                  ))}

                  {moduleScores.length === 0 && (
                    <div className="col-span-full py-8 text-center text-xs text-slate-500">
                      No directory modules with debt markers found.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Developer Debt Attribution Section */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Contributor Debt Attribution</CardTitle>
                      <CardDescription className="text-xs">
                        Debt markers introduced vs resolved per developer
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {attributions.length} contributors
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attributions.map((dev) => (
                    <div
                      key={dev.developerId}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={dev.avatarUrl}
                          name={dev.developerName}
                          size="md"
                          className="h-9 w-9"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {dev.developerName}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            {dev.developerEmail || 'Contributor'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-xs">
                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Introduced
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {dev.debtIntroduced || dev.introduced || 0}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Resolved
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {dev.debtResolved || dev.resolved || 0}
                          </span>
                        </div>
                        <div className="text-center min-w-[70px]">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Net Balance
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              dev.netDebt <= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {dev.netDebt > 0 ? `+${dev.netDebt}` : dev.netDebt}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {attributions.length === 0 && (
                    <div className="py-10 text-center text-xs text-slate-500">
                      No contributor attribution records found for current debt items.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>

      {/* Slide-Over Detail Drawer (Radix Sheet) */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-white dark:bg-slate-900 overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-1">
                  {getMarkerBadge(selectedItem.markerType)}
                  {selectedItem.isResolved ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                      Resolved
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 border-slate-300">
                      Open Item
                    </Badge>
                  )}
                </div>
                <SheetTitle className="text-lg font-bold">
                  Code Marker Inspection
                </SheetTitle>
                <SheetDescription>
                  Detailed technical debt marker context and remediation path.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 py-4 text-xs">
                {/* File Location Box */}
                <div className="space-y-1.5">
                  <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    File Location
                  </span>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="font-mono text-slate-800 dark:text-slate-200 truncate pr-2">
                      {selectedItem.filePath}:{selectedItem.lineNumber}
                    </span>
                    <button
                      onClick={(e) => handleCopy(`${selectedItem.filePath}:${selectedItem.lineNumber}`, e)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                    >
                      {copiedText === `${selectedItem.filePath}:${selectedItem.lineNumber}` ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Code Snippet Box */}
                <div className="space-y-1.5">
                  <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    Extracted Code Comment
                  </span>
                  <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs border border-slate-800 overflow-x-auto">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 select-none">{selectedItem.lineNumber} |</span>
                      <span className="text-indigo-400 select-none font-bold">// {selectedItem.markerType}:</span>
                      <span className="text-slate-200">{selectedItem.content}</span>
                    </div>
                  </div>
                </div>

                {/* Marker Type Guidance */}
                <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/40 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
                    <Code2 className="h-4 w-4" />
                    <span>Marker Significance</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    {selectedItem.markerType === 'FIXME' &&
                      'FIXME identifies known bugs, broken functionality, or incomplete edge-case handling requiring high-priority correction.'}
                    {selectedItem.markerType === 'HACK' &&
                      'HACK marks temporary workarounds, unscalable bypasses, or brittle patches that should be replaced with robust architecture.'}
                    {selectedItem.markerType === 'XXX' &&
                      'XXX signals high-risk sections that work but require significant caution due to subtle invariants or potential regressions.'}
                    {selectedItem.markerType === 'TODO' &&
                      'TODO represents planned improvements or missing features left for subsequent engineering iterations.'}
                  </p>
                </div>

                {/* Author Attribution */}
                {selectedItem.author && (
                  <div className="space-y-1.5">
                    <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                      Author Attribution
                    </span>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <Avatar
                        src={selectedItem.author.avatarUrl}
                        name={selectedItem.author.name}
                        size="md"
                        className="h-8 w-8"
                      />
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedItem.author.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {selectedItem.author.email}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Commit Information */}
                {selectedItem.introducedCommit && (
                  <div className="space-y-1.5">
                    <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                      Introduced in Commit
                    </span>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                          {selectedItem.introducedCommit.sha.slice(0, 8)}
                        </span>
                        <button
                          onClick={(e) => handleCopy(selectedItem.introducedCommit?.sha || '', e)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-sans text-xs">
                        {selectedItem.introducedCommit.message}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <SheetFooter className="mt-4 gap-2">
                {!selectedItem.isResolved ? (
                  <Button
                    onClick={() => {
                      resolveMutation.mutate(selectedItem.id)
                      setIsDrawerOpen(false)
                    }}
                    disabled={resolveMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Mark as Resolved</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-full"
                  >
                    Close
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
