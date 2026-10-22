import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Search,
  RotateCcw,
  MoreHorizontal,
  Copy,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Database,
  Layers,
  Eye,
  GitBranch,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { reportsService, teamsService, projectsService, membersService, repositoriesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { QueryState } from '../pageUtils'
import { ReportDetailDrawer, ReportPresetsBar, type ReportPreset } from './components'
import type { Report, ReportScope } from '@/types'

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function ReportsPage() {
  const queryClient = useQueryClient()

  // Filters
  const [scopeFilter, setScopeFilter] = useState<string>('ALL')
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'PDF' | 'CSV'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PROCESSING' | 'FAILED'>('ALL')
  const [repositoryFilter, setRepositoryFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Generation Sheet State
  const [isGenerateSheetOpen, setIsGenerateSheetOpen] = useState(false)
  const [newReportScope, setNewReportScope] = useState<ReportScope>('ORGANIZATION')
  const [newReportFormat, setNewReportFormat] = useState<'pdf' | 'csv'>('pdf')
  const [newReportTitle, setNewReportTitle] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedDeveloperId, setSelectedDeveloperId] = useState('')
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [sheetError, setSheetError] = useState<string | null>(null)

  // Inspection Drawer & Confirm Delete
  const [selectedReportForDrawer, setSelectedReportForDrawer] = useState<Report | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<string | null>(null)

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Query connected repositories for filtering and generation
  const { data: repositories = [] } = useQuery({
    queryKey: queryKeys.repositories.all(),
    queryFn: () => repositoriesService.getAll(),
  })

  const repoMap = useMemo(
    () => new Map(repositories.map((r: any) => [r.id, r])),
    [repositories]
  )

  const activeRepoFilterId = repositoryFilter !== 'ALL' ? repositoryFilter : undefined

  // Query reports with auto-polling when any report is processing or pending
  const reportsQuery = useQuery({
    queryKey: queryKeys.reports.all({ repositoryId: activeRepoFilterId }),
    queryFn: () => reportsService.getAll({ repositoryId: activeRepoFilterId, limit: 100 }),
    refetchInterval: (query) => {
      const data = query.state.data
      const hasInProgress = data?.reports?.some(
        (r: Report) => r.status === 'PENDING' || r.status === 'PROCESSING'
      )
      return hasInProgress ? 2500 : false
    },
  })

  // Query helper entities for sheet dropdowns
  const { data: teams = [] } = useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: () => teamsService.getAll(),
    enabled: isGenerateSheetOpen && newReportScope === 'TEAM',
  })

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => projectsService.getAll(),
    enabled: isGenerateSheetOpen && newReportScope === 'PROJECT',
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersService.getAll(),
    enabled: isGenerateSheetOpen && newReportScope === 'DEVELOPER',
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => reportsService.create(payload, newReportFormat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setIsGenerateSheetOpen(false)
      setSheetError(null)
      setNewReportTitle('')
      toast.success('Report generation initiated', {
        description: `Export queued as ${newReportFormat.toUpperCase()}. It will download once ready.`,
      })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to generate report'
      const formatted = Array.isArray(msg) ? msg.join(', ') : msg
      setSheetError(formatted)
      toast.error('Failed to start report generation', { description: formatted })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setReportToDelete(null)
      setIsDetailDrawerOpen(false)
      setSelectedReportForDrawer(null)
      toast.success('Report deleted successfully')
    },
    onError: (err: any) => {
      setReportToDelete(null)
      toast.error('Failed to delete report', {
        description: err?.message || 'Please try again later',
      })
    },
  })

  const retryMutation = useMutation({
    mutationFn: (id: string) => reportsService.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.info('Report retry triggered')
    },
    onError: (err: any) => {
      toast.error('Failed to retry report compilation', {
        description: err?.message || 'Please try again later',
      })
    },
  })

  const reportsList = reportsQuery.data?.reports ?? []

  // Metrics Calculations for Executive KPI Strip
  const completedReports = useMemo(
    () => reportsList.filter((r: Report) => r.status === 'COMPLETED'),
    [reportsList]
  )
  const inProgressReports = useMemo(
    () => reportsList.filter((r: Report) => r.status === 'PENDING' || r.status === 'PROCESSING'),
    [reportsList]
  )
  const failedReports = useMemo(
    () => reportsList.filter((r: Report) => r.status === 'FAILED'),
    [reportsList]
  )
  const pdfCount = useMemo(
    () => reportsList.filter((r: Report) => (r.type || 'PDF').toUpperCase() === 'PDF').length,
    [reportsList]
  )
  const csvCount = useMemo(
    () => reportsList.filter((r: Report) => (r.type || 'PDF').toUpperCase() === 'CSV').length,
    [reportsList]
  )
  const totalStorageBytes = useMemo(
    () => reportsList.reduce((acc: number, r: Report) => acc + (r.fileSize || 0), 0),
    [reportsList]
  )
  const successRate = useMemo(() => {
    if (reportsList.length === 0) return 100
    const finishedCount = completedReports.length + failedReports.length
    if (finishedCount === 0) return 100
    return Math.round((completedReports.length / finishedCount) * 100)
  }, [reportsList, completedReports, failedReports])

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reportsList.filter((r: Report) => {
      // Scope filter
      if (scopeFilter !== 'ALL') {
        const reportScope = (r.scope || 'ORGANIZATION').toUpperCase()
        if (reportScope !== scopeFilter) return false
      }

      // Format filter
      if (formatFilter !== 'ALL') {
        const reportType = (r.type || 'PDF').toUpperCase()
        if (reportType !== formatFilter) return false
      }

      // Repository filter
      if (repositoryFilter !== 'ALL') {
        if (r.repositoryId !== repositoryFilter) return false
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'COMPLETED' && r.status !== 'COMPLETED') return false
        if (statusFilter === 'PROCESSING' && (r.status !== 'PENDING' && r.status !== 'PROCESSING')) return false
        if (statusFilter === 'FAILED' && r.status !== 'FAILED') return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = r.title?.toLowerCase().includes(q)
        const filenameMatch = r.filename?.toLowerCase().includes(q)
        if (!titleMatch && !filenameMatch) return false
      }

      return true
    })
  }, [reportsList, scopeFilter, formatFilter, repositoryFilter, statusFilter, searchQuery])

  // Handle browser file download
  const handleDownload = async (report: Report) => {
    try {
      setDownloadingId(report.id)
      const blob = await reportsService.download(report.id)
      const mimeType = report.type === 'CSV' ? 'text/csv' : 'application/pdf'
      const fileBlob = new Blob([blob], { type: mimeType })
      const url = window.URL.createObjectURL(fileBlob)
      const a = document.createElement('a')
      a.href = url
      const ext = (report.type || 'PDF').toLowerCase()
      const filename = report.filename || `${report.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`Downloaded ${filename}`)
    } catch (e: any) {
      console.error('Failed to download report', e)
      toast.error('Failed to download report', {
        description: e?.message || 'File artifact not available',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id)
    toast.success('Report ID copied to clipboard')
  }

  // Open sheet and seed defaults
  const openGenerateSheet = () => {
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)

    setDateRange({
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    })
    setNewReportScope('ORGANIZATION')
    setNewReportFormat('pdf')
    setNewReportTitle('Monthly Executive Quality Report')
    setSelectedTeamId('')
    setSelectedProjectId('')
    setSelectedDeveloperId('')
    setSelectedRepoId('')
    setSheetError(null)
    setIsGenerateSheetOpen(true)
  }

  // Quick preset trigger
  const handleSelectPreset = (preset: ReportPreset) => {
    const today = new Date()
    const startDate = new Date()
    startDate.setDate(today.getDate() - preset.days)

    setDateRange({
      start: startDate.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    })
    setNewReportScope(preset.scope)
    setNewReportFormat(preset.format)
    setNewReportTitle(preset.title)
    setSelectedTeamId('')
    setSelectedProjectId('')
    setSelectedDeveloperId('')
    setSelectedRepoId('')
    setSheetError(null)
    setIsGenerateSheetOpen(true)
  }

  const handleScopeChange = (scope: ReportScope) => {
    setNewReportScope(scope)
    setSelectedTeamId('')
    setSelectedProjectId('')
    setSelectedDeveloperId('')
    setSelectedRepoId('')
    switch (scope) {
      case 'ORGANIZATION':
        setNewReportTitle('Monthly Executive Quality Report')
        break
      case 'REPOSITORY':
        setNewReportTitle('Repository Quality Audit Report')
        break
      case 'TEAM':
        setNewReportTitle('Team Engineering Performance Report')
        break
      case 'PROJECT':
        setNewReportTitle('Project System Quality Report')
        break
      case 'DEVELOPER':
        setNewReportTitle('Developer Quality Score (DQS) Report')
        break
    }
  }

  // Submit report generation
  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    setSheetError(null)

    if (!newReportTitle.trim()) {
      setSheetError('Report title is required')
      return
    }

    if (!dateRange.start || !dateRange.end) {
      setSheetError('Start and end dates are required')
      return
    }

    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)

    if (endDate <= startDate) {
      setSheetError('End date must be strictly after start date')
      return
    }

    if (newReportScope === 'REPOSITORY' && !selectedRepoId) {
      setSheetError('Please select a repository for repository-scoped reports')
      return
    }

    if (newReportScope === 'TEAM' && !selectedTeamId) {
      setSheetError('Please select a team for team-scoped reports')
      return
    }

    if (newReportScope === 'PROJECT' && !selectedProjectId) {
      setSheetError('Please select a project for project-scoped reports')
      return
    }

    if (newReportScope === 'DEVELOPER' && !selectedDeveloperId) {
      setSheetError('Please select a developer for developer-scoped reports')
      return
    }

    const payload: any = {
      title: newReportTitle.trim(),
      scope: newReportScope,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }

    if (newReportScope === 'REPOSITORY') payload.repositoryId = selectedRepoId
    if (newReportScope === 'TEAM') payload.teamId = selectedTeamId
    if (newReportScope === 'PROJECT') payload.projectId = selectedProjectId
    if (newReportScope === 'DEVELOPER') payload.developerId = selectedDeveloperId

    createMutation.mutate(payload)
  }

  const getScopeDescription = (scope: ReportScope) => {
    switch (scope) {
      case 'ORGANIZATION':
        return 'High-level executive summary of organizational engineering health, velocity, and quality scores.'
      case 'REPOSITORY':
        return 'Codebase line coverage, technical debt markers, commit velocity, and review turnaround scoped strictly to one repository.'
      case 'TEAM':
        return 'Detailed team-level velocity metrics, code quality trends, and pull request turnaround.'
      case 'PROJECT':
        return 'Repository health, test coverage benchmarks, and system quality scores (SQS).'
      case 'DEVELOPER':
        return 'Developer quality metrics (DQS), contribution volume, and review activity breakdown.'
    }
  }

  const scopeTabs = [
    { value: 'ALL', label: 'All Scopes' },
    { value: 'ORGANIZATION', label: 'Organization' },
    { value: 'REPOSITORY', label: 'Repository' },
    { value: 'PROJECT', label: 'Project' },
    { value: 'TEAM', label: 'Team' },
    { value: 'DEVELOPER', label: 'Developer' },
  ]

  const statusTabs = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'COMPLETED', label: 'Ready' },
    { value: 'PROCESSING', label: 'Compiling' },
    { value: 'FAILED', label: 'Failed' },
  ]

  return (
    <div className="space-y-6">
      {/* Executive Top Header Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs">
            <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Engineering Reports &amp; Compliance Studio
              </h1>
              <Badge
                variant="outline"
                className="text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
              >
                Executive Telemetry
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compile, audit, and export executive quality summaries, DQS telemetry, and sprint velocity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {inProgressReports.length > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
              <span>{inProgressReports.length} compiling</span>
            </div>
          )}

          <Button
            size="sm"
            onClick={openGenerateSheet}
            className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Compile New Report
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => reportsQuery.refetch()}
            disabled={reportsQuery.isFetching}
            className="h-8 w-8 p-0 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title="Refresh Data"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${reportsQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <QueryState isLoading={reportsQuery.isLoading} error={reportsQuery.error} onRetry={() => reportsQuery.refetch()}>
        {/* Executive 5-Card KPI Strip */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Total Reports */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Reports</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {reportsList.length}
                  </span>
                  <span className="text-xs text-slate-500">artifacts</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {pdfCount} PDF • {csvCount} CSV
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                <FileText className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Ready Artifacts */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ready Artifacts</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {completedReports.length}
                  </span>
                  <span className="text-xs text-slate-500">compiled</span>
                </div>
                <p className="text-[11px] text-slate-400">Available for download</p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Active Compilation Queue */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compilation Queue</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {inProgressReports.length}
                  </span>
                  <span className="text-xs text-slate-500">jobs</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {inProgressReports.length > 0 ? 'Active workers compiling' : 'Workers idle'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Generation Reliability */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reliability Rate</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                    {successRate}%
                  </span>
                  <span className="text-xs text-slate-500">success</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {failedReports.length} compilation {failedReports.length === 1 ? 'error' : 'errors'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Export Volume */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Storage Volume</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                    {formatBytes(totalStorageBytes)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Cumulative artifact size</p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50">
                <Database className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 1-Click Executive Presets Bar */}
        <ReportPresetsBar onSelectPreset={handleSelectPreset} />

        {/* Filter Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs">
          {/* Left: Search Bar & Scope Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search report title or filename..."
                className="w-full h-8 pl-8 pr-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Scope Filter Pills */}
            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 h-8">
              {scopeTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setScopeFilter(tab.value)}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all select-none cursor-pointer ${
                    scopeFilter === tab.value
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Repository Filter Select */}
            {repositories.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 h-8 text-xs">
                <GitBranch className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <select
                  value={repositoryFilter}
                  onChange={(e) => setRepositoryFilter(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    All Repositories
                  </option>
                  {repositories.map((repo: any) => (
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

            {/* Status Filter Pills */}
            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 h-8">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value as any)}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all select-none cursor-pointer ${
                    statusFilter === tab.value
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Format Pills & Counter */}
          <div className="flex items-center gap-2 justify-between lg:justify-end">
            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 h-8">
              {(['ALL', 'PDF', 'CSV'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormatFilter(fmt)}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all select-none cursor-pointer ${
                    formatFilter === fmt
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-mono tabular-nums text-slate-400 px-2">
              {filteredReports.length} {filteredReports.length === 1 ? 'record' : 'records'}
            </div>
          </div>
        </div>

        {/* High-Density Reports Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="h-10 hover:bg-transparent bg-slate-50/75 dark:bg-slate-900/50">
                <TableHead className="w-[340px] text-xs font-semibold">Report Name</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold">Scope</TableHead>
                <TableHead className="w-[190px] text-xs font-semibold">Period</TableHead>
                <TableHead className="w-[90px] text-xs font-semibold">Size</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold">Created</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold">Status</TableHead>
                <TableHead className="w-[120px] text-right text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.map((report: Report) => {
                const isCompleted = report.status === 'COMPLETED'
                const isProcessing = report.status === 'PROCESSING' || report.status === 'PENDING'
                const isFailed = report.status === 'FAILED'
                const isPdf = (report.type || 'PDF').toUpperCase() === 'PDF'

                return (
                  <TableRow
                    key={report.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedReportForDrawer(report)
                      setIsDetailDrawerOpen(true)
                    }}
                  >
                    {/* Report Name & Type Icon */}
                    <TableCell className="font-medium py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                            isPdf
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/60'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/60'
                          }`}
                        >
                          {isPdf ? (
                            <FileText className="h-3.5 w-3.5" />
                          ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span
                            className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 truncate block text-xs"
                            title={report.title}
                          >
                            {report.title}
                          </span>
                          {report.filename && (
                            <span className="text-[11px] font-mono text-slate-400 truncate block">
                              {report.filename}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Scope Badge & Repo Badge */}
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {report.scope || 'ORGANIZATION'}
                        </span>
                        {report.repositoryId && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 truncate max-w-[130px]"
                            title={repoMap.get(report.repositoryId)?.fullName || 'Repository'}
                          >
                            {repoMap.get(report.repositoryId)?.name || 'Repository'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Period */}
                    <TableCell className="font-mono text-xs tabular-nums text-slate-500 py-3">
                      {report.startDate
                        ? `${new Date(report.startDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })} – ${new Date(report.endDate || '').toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : 'Standard 30 Days'}
                    </TableCell>

                    {/* Size */}
                    <TableCell className="font-mono text-xs tabular-nums text-slate-500 py-3">
                      {report.fileSize ? formatBytes(report.fileSize) : '—'}
                    </TableCell>

                    {/* Created */}
                    <TableCell className="font-mono text-xs tabular-nums text-slate-500 py-3">
                      {new Date(report.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Ready
                        </span>
                      )}
                      {isProcessing && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                          Compiling
                        </span>
                      )}
                      {isFailed && (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          title={report.errorMessage || 'Generation error'}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Failed
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1 cursor-pointer"
                          onClick={() => {
                            setSelectedReportForDrawer(report)
                            setIsDetailDrawerOpen(true)
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Inspect</span>
                        </Button>

                        {isCompleted && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                            onClick={() => handleDownload(report)}
                            disabled={downloadingId === report.id}
                            title={`Download ${report.type || 'PDF'}`}
                          >
                            {downloadingId === report.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}

                        {isFailed && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700 cursor-pointer"
                            onClick={() => retryMutation.mutate(report.id)}
                            disabled={retryMutation.isPending}
                            title="Retry compilation"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isCompleted && (
                              <DropdownMenuItem onClick={() => handleDownload(report)}>
                                <Download className="h-3.5 w-3.5 mr-2" /> Download file
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleCopyId(report.id)}>
                              <Copy className="h-3.5 w-3.5 mr-2" /> Copy report ID
                            </DropdownMenuItem>
                            {isFailed && (
                              <DropdownMenuItem onClick={() => retryMutation.mutate(report.id)}>
                                <RotateCcw className="h-3.5 w-3.5 mr-2" /> Retry generation
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setReportToDelete(report.id)}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete report
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {filteredReports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 p-6">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          No reports match current filters
                        </p>
                        <p className="text-xs text-slate-400 max-w-md">
                          {reportsList.length === 0
                            ? 'Compile your first executive report or select one of the 1-click presets above to generate quality telemetry.'
                            : 'Adjust your search query, scope, or status filters to inspect archived reports.'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={openGenerateSheet}
                        className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs mt-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Compile New Report
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </QueryState>

      {/* Slide-Over Drawer for Report Inspection */}
      <ReportDetailDrawer
        report={selectedReportForDrawer}
        open={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false)
          setSelectedReportForDrawer(null)
        }}
        onDownload={handleDownload}
        onRetry={(id) => retryMutation.mutate(id)}
        onDelete={(id) => setReportToDelete(id)}
        isDownloading={downloadingId === selectedReportForDrawer?.id}
        isRetrying={retryMutation.isPending}
      />

      {/* Slide-Over Drawer (Sheet) for Report Generation */}
      <Sheet open={isGenerateSheetOpen} onOpenChange={setIsGenerateSheetOpen}>
        <SheetContent side="right" className="flex flex-col h-full w-full sm:max-w-lg">
          <SheetHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <SheetTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" />
              Generate Engineering Report
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Compile automated quality metrics, DQS benchmarks, and velocity telemetry.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleGenerate} className="flex-1 flex flex-col justify-between overflow-y-auto pt-4 space-y-4">
            <div className="space-y-4">
              {sheetError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <span>{sheetError}</span>
                </div>
              )}

              {/* Title */}
              <Input
                label="Report Title"
                value={newReportTitle}
                onChange={(e) => setNewReportTitle(e.target.value)}
                placeholder="e.g. Monthly Executive Quality Report"
                required
                autoFocus
                className="text-xs"
              />

              {/* Scope & Format Custom Selects */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Report Scope</label>
                  <Select
                    value={newReportScope}
                    onValueChange={(val) => handleScopeChange(val as ReportScope)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORGANIZATION">Organization-Wide</SelectItem>
                      <SelectItem value="REPOSITORY">Repository Specific</SelectItem>
                      <SelectItem value="PROJECT">Project Specific</SelectItem>
                      <SelectItem value="TEAM">Team Specific</SelectItem>
                      <SelectItem value="DEVELOPER">Developer Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Export Format</label>
                  <Select
                    value={newReportFormat}
                    onValueChange={(val) => setNewReportFormat(val as 'pdf' | 'csv')}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document (.pdf)</SelectItem>
                      <SelectItem value="csv">CSV Spreadsheet (.csv)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional Entity Selectors */}
              {newReportScope === 'REPOSITORY' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Repository</label>
                  <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Choose a repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {repositories.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.fullName || r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {newReportScope === 'TEAM' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Team</label>
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newReportScope === 'PROJECT' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Project</label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Choose a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newReportScope === 'DEVELOPER' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Developer</label>
                  <Select value={selectedDeveloperId} onValueChange={setSelectedDeveloperId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Choose a developer" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m: any) => (
                        <SelectItem key={m.user.id} value={m.user.id}>
                          {m.user.name || m.user.email} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date Ranges */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  required
                  className="text-xs"
                />
                <Input
                  label="End Date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  required
                  className="text-xs"
                />
              </div>

              {/* Scope Detail Callout */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3.5 space-y-1 text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-500" /> Scope Parameters
                </div>
                <p className="text-slate-500 leading-relaxed">
                  {getScopeDescription(newReportScope)}
                </p>
              </div>
            </div>

            <SheetFooter className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsGenerateSheetOpen(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={createMutation.isPending}
                className="text-xs gap-1.5 font-medium bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                Compile {newReportFormat.toUpperCase()}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!reportToDelete}
        onClose={() => setReportToDelete(null)}
        onConfirm={() => reportToDelete && deleteMutation.mutate(reportToDelete)}
        title="Delete Engineering Report"
        description="Are you sure you want to permanently delete this report artifact? Any downloaded local copies will remain unaffected, but the server record and artifact will be removed."
        confirmText="Delete Artifact"
        confirmVariant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default ReportsPage
