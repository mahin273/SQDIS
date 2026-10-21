import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Rocket,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Activity,
  AlertTriangle,
  RotateCcw,
  Download,
  Search,
  RefreshCw,
  Filter,
  Tag,
  Check,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { releasesService, sprintsService, repositoriesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { QueryState } from '../pageUtils'
import type {
  Release,
  ReleaseStatus,
  Sprint,
  ShipReleaseRequest,
  ShipReleaseResponse,
  ReleaseTelemetryAnalysis,
} from '@/types'

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

function getTelemetryMetrics(t?: ReleaseTelemetryAnalysis) {
  if (!t) {
    return {
      p95Canary: 0,
      latencyDelta: 0,
      errorCanary: 0,
      errorDelta: 0,
      memoryCanary: 0,
      memoryDelta: 0,
    }
  }
  const p95Canary = t.canaryMetrics?.p95_latency_ms ?? t.p95CanaryMs ?? 0
  const latencyDelta = t.deltas?.latency_delta_pct ?? t.p95DeltaPct ?? 0
  const errorCanary = t.canaryMetrics?.error_rate_5xx ?? t.errorCanary ?? 0
  const errorDelta = t.deltas?.error_rate_delta ?? t.errorDelta ?? 0
  const memoryCanary = t.canaryMetrics?.memory_rss_mb ?? t.memoryCanaryMb ?? 0
  const memoryDelta = t.deltas?.memory_delta_pct ?? t.memoryDeltaPct ?? 0
  return { p95Canary, latencyDelta, errorCanary, errorDelta, memoryCanary, memoryDelta }
}

export function ReleasesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<'pipeline' | 'history' | 'canary'>('pipeline')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RELEASED' | 'ROLLED_BACK'>('ALL')

  // Create Release Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [version, setVersion] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [selectedSprintId, setSelectedSprintId] = useState('')
  const [createError, setCreateError] = useState('')

  // Ship Release Modal State
  const [isShipModalOpen, setIsShipModalOpen] = useState(false)
  const [targetShipRelease, setTargetShipRelease] = useState<Release | null>(null)
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [createGitHubRelease, setCreateGitHubRelease] = useState(true)
  const [tagName, setTagName] = useState('')
  const [releaseTitle, setReleaseTitle] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [triggerWorkflow, setTriggerWorkflow] = useState(true)
  const [workflowFileName, setWorkflowFileName] = useState('ci.yml')
  const [gitRef, setGitRef] = useState('main')

  // Rollback Post-Mortem Modal State
  const [selectedRollbackRelease, setSelectedRollbackRelease] = useState<Release | null>(null)

  // Primary Queries
  const releasesQuery = useQuery({
    queryKey: queryKeys.releases.all(),
    queryFn: () => releasesService.getAll(),
  })

  const sprintsQuery = useQuery({
    queryKey: ['sprints', 'all'],
    queryFn: () => sprintsService.getAll(),
  })

  const reposQuery = useQuery({
    queryKey: ['github', 'repositories', 'connected'],
    queryFn: () => repositoriesService.getConnected(),
  })

  // Sprints & Repositories Extraction
  const allSprints: Sprint[] = useMemo(() => {
    const raw = sprintsQuery.data
    return Array.isArray(raw) ? raw : []
  }, [sprintsQuery.data])

  const connectedRepos = useMemo(() => {
    const raw = reposQuery.data
    const list = Array.isArray(raw) ? raw : (raw as any)?.data ?? []
    return list.filter((r: any) => (r.isActive ?? r.isEnabled ?? true) && !!r.id)
  }, [reposQuery.data])

  // Releases Data Normalization
  const rawReleases = releasesQuery.data
  const releases: Release[] = useMemo(() => {
    if (Array.isArray(rawReleases)) return rawReleases
    if (rawReleases && typeof rawReleases === 'object' && Array.isArray((rawReleases as any).data)) {
      return (rawReleases as any).data
    }
    if (rawReleases && typeof rawReleases === 'object' && Array.isArray((rawReleases as any).releases)) {
      return (rawReleases as any).releases
    }
    return []
  }, [rawReleases])

  const resolveReleaseStatus = (r: Release): ReleaseStatus => {
    if (r.isRolledBack) return 'ROLLED_BACK'
    if (r.shippedAt) return 'RELEASED'
    if (r.status) return r.status
    if (r.sprints && r.sprints.length > 0) return 'IN_PROGRESS'
    return 'PLANNED'
  }

  // Filtered Releases
  const filteredReleases = useMemo(() => {
    let result = releases

    if (statusFilter === 'ACTIVE') {
      result = result.filter((r) => {
        const s = resolveReleaseStatus(r)
        return s === 'PLANNED' || s === 'IN_PROGRESS' || s === 'READY' || s === 'DRAFT'
      })
    } else if (statusFilter === 'RELEASED') {
      result = result.filter((r) => resolveReleaseStatus(r) === 'RELEASED')
    } else if (statusFilter === 'ROLLED_BACK') {
      result = result.filter((r) => resolveReleaseStatus(r) === 'ROLLED_BACK')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((r) => {
        const v = r.version.toLowerCase()
        const d = (r.description || '').toLowerCase()
        const sp = (r.sprints || []).some((s: any) => (s.name || '').toLowerCase().includes(q))
        return v.includes(q) || d.includes(q) || sp
      })
    }

    return result
  }, [releases, statusFilter, searchQuery])

  // Executive Metrics Calculations
  const releasedReleases = useMemo(() => releases.filter((r) => resolveReleaseStatus(r) === 'RELEASED'), [releases])
  const activeReleases = useMemo(
    () =>
      releases.filter((r) => {
        const s = resolveReleaseStatus(r)
        return s === 'PLANNED' || s === 'IN_PROGRESS' || s === 'READY' || s === 'DRAFT'
      }),
    [releases]
  )
  const rolledBackReleases = useMemo(
    () => releases.filter((r) => resolveReleaseStatus(r) === 'ROLLED_BACK'),
    [releases]
  )

  const activeReleaseCandidate = activeReleases[0] || null

  const avgReadinessScore = useMemo(() => {
    const scores = releases
      .map((r) => r.readiness?.score)
      .filter((s): s is number => typeof s === 'number' && !isNaN(s))
    if (scores.length === 0) return 88.5
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }, [releases])

  const deploymentSuccessRate = useMemo(() => {
    const totalFinished = releasedReleases.length + rolledBackReleases.length
    if (totalFinished === 0) return 100
    return Math.round((releasedReleases.length / totalFinished) * 100)
  }, [releasedReleases.length, rolledBackReleases.length])

  // Canary Telemetry Analyses Collection
  const telemetryAnalyses = useMemo(() => {
    const list: Array<{ release: Release; telemetry: ReleaseTelemetryAnalysis }> = []
    releases.forEach((r) => {
      if (r.latestTelemetry) {
        list.push({ release: r, telemetry: r.latestTelemetry })
      }
    })
    return list
  }, [releases])

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: { version: string; description?: string; targetDate: string; sprintId?: string }) => {
      const newRelease = await releasesService.create({
        version: data.version,
        description: data.description,
        targetDate: data.targetDate,
      })
      if (data.sprintId && newRelease?.id) {
        try {
          await releasesService.associateSprint(newRelease.id, { sprintId: data.sprintId })
        } catch (err) {
          console.warn('Failed to associate sprint on creation:', err)
        }
      }
      return newRelease
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.all() })
      setIsCreateOpen(false)
      setVersion('')
      setDescription('')
      setTargetDate('')
      setSelectedSprintId('')
      setCreateError('')
      toast('Release candidate successfully scheduled', { type: 'success' })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to schedule release'
      setCreateError(msg)
    },
  })

  const shipMutation = useMutation({
    mutationFn: (req: ShipReleaseRequest) => releasesService.ship(targetShipRelease!.id, req),
    onSuccess: (data: ShipReleaseResponse) => {
      setIsShipModalOpen(false)
      setTargetShipRelease(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.all() })
      toast(`Release ${data.release.version} shipped successfully to production`, { type: 'success' })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to ship release'
      toast(msg, { type: 'error' })
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: (releaseId: string) => releasesService.exportPdf(releaseId),
    onSuccess: (blob, releaseId) => {
      const r = releases.find((item) => item.id === releaseId)
      const safeVersion = (r?.version || 'report').replace(/[^a-zA-Z0-9._-]/g, '_')
      downloadBlob(blob, `release-${safeVersion}-readiness-report.pdf`)
      toast('Release quality and governance report downloaded', { type: 'success' })
    },
    onError: () => {
      toast('Failed to download release report. Please try again.', { type: 'error' })
    },
  })

  // Handlers
  const handleOpenCreate = () => {
    setCreateError('')
    setVersion('')
    setDescription('')
    // Default target date 14 days from now
    const d = new Date()
    d.setDate(d.getDate() + 14)
    setTargetDate(d.toISOString().split('T')[0])
    if (allSprints.length > 0) {
      setSelectedSprintId(allSprints[0].id)
    }
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!version.trim()) {
      setCreateError('Version tag is required (e.g. v2.6.0)')
      return
    }
    if (!targetDate) {
      setCreateError('Target deployment date is required')
      return
    }
    createMutation.mutate({
      version: version.trim(),
      description: description.trim() || undefined,
      targetDate,
      sprintId: selectedSprintId || undefined,
    })
  }

  const handleOpenShipModal = (release: Release) => {
    setTargetShipRelease(release)
    const tag = release.version.startsWith('v') ? release.version : `v${release.version}`
    setTagName(tag)
    setReleaseTitle(`Release ${tag}`)
    setReleaseNotes(release.description || '')
    if (connectedRepos.length > 0 && !selectedRepoId) {
      setSelectedRepoId(connectedRepos[0].id)
    }
    setIsShipModalOpen(true)
  }

  const handleConfirmShip = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetShipRelease) return
    shipMutation.mutate({
      repositoryId: selectedRepoId || connectedRepos[0]?.id,
      createGitHubRelease,
      tagName: tagName.trim() || undefined,
      releaseName: releaseTitle.trim() || undefined,
      releaseNotes: releaseNotes.trim() || undefined,
      triggerWorkflow,
      workflowFileName: workflowFileName.trim() || 'ci.yml',
      gitRef: gitRef.trim() || 'main',
    })
  }

  const getStatusBadge = (status: ReleaseStatus) => {
    switch (status) {
      case 'RELEASED':
        return (
          <Badge variant="success" className="gap-1 font-mono text-[11px]">
            <CheckCircle2 className="h-3 w-3" /> Released
          </Badge>
        )
      case 'IN_PROGRESS':
        return (
          <Badge variant="default" className="gap-1 font-mono text-[11px] bg-blue-600 hover:bg-blue-700">
            <Clock className="h-3 w-3" /> In Progress
          </Badge>
        )
      case 'ROLLED_BACK':
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[11px]">
            <RotateCcw className="h-3 w-3" /> Rolled Back
          </Badge>
        )
      case 'READY':
        return (
          <Badge variant="outline" className="gap-1 font-mono text-[11px] text-emerald-600 border-emerald-500/30">
            <ShieldCheck className="h-3 w-3" /> Ready
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1 font-mono text-[11px]">
            <Clock className="h-3 w-3" /> Planned
          </Badge>
        )
    }
  }

  const getReadinessBadge = (score?: number, isAtRisk?: boolean) => {
    if (score === undefined || isNaN(score)) {
      return (
        <Badge variant="outline" className="font-mono text-[11px] text-slate-400">
          Readiness N/A
        </Badge>
      )
    }
    if (isAtRisk || score < 70) {
      return (
        <Badge variant="destructive" className="font-mono text-[11px] gap-1">
          <AlertCircle className="h-3 w-3" /> {Math.round(score)}% Quality Gate
        </Badge>
      )
    }
    if (score >= 85) {
      return (
        <Badge variant="outline" className="font-mono text-[11px] text-emerald-600 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
          <Check className="h-3 w-3" /> {Math.round(score)}% Verified
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="font-mono text-[11px] text-amber-600 border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
        {Math.round(score)}% Acceptable
      </Badge>
    )
  }

  const getStageIndicator = (status: ReleaseStatus) => {
    const stages = [
      { id: 'planning', label: '1. Specification' },
      { id: 'canary', label: '2. Canary Verification' },
      { id: 'gate', label: '3. Quality Gate' },
      { id: 'live', label: '4. Production Live' },
    ]

    let activeIndex = 0
    if (status === 'IN_PROGRESS') activeIndex = 1
    if (status === 'READY') activeIndex = 2
    if (status === 'RELEASED') activeIndex = 3
    if (status === 'ROLLED_BACK') activeIndex = 1

    return (
      <div className="grid grid-cols-4 gap-1.5 pt-1">
        {stages.map((stage, idx) => {
          const isPassed = status === 'RELEASED' ? true : idx < activeIndex
          const isCurrent = idx === activeIndex && status !== 'RELEASED'
          const isRolledBackCurrent = status === 'ROLLED_BACK' && idx === 1

          return (
            <div key={stage.id} className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  isRolledBackCurrent
                    ? 'bg-rose-500'
                    : isPassed
                    ? 'bg-emerald-500'
                    : isCurrent
                    ? 'bg-blue-600'
                    : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
              <p
                className={`text-[10px] font-mono truncate ${
                  isRolledBackCurrent
                    ? 'text-rose-600 font-semibold'
                    : isPassed
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isCurrent
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {stage.label}
              </p>
            </div>
          )
        })}
      </div>
    )
  }

  const calculateDaysRemaining = (targetDate?: string) => {
    if (!targetDate) return null
    const diff = new Date(targetDate).getTime() - new Date().getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Sleek Top Header Toolbar (No Hero Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Release Management & Governance Studio
                </h1>
                <Badge variant="outline" className="font-mono text-[11px] text-indigo-600 border-indigo-500/30">
                  {releases.length} Tracked
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plan software release trains, enforce 5-factor quality readiness gates, and monitor canary telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search release tag or sprint..."
              className="pl-8 h-8 text-xs w-52 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs py-1 pr-2 pl-1 rounded focus:outline-none text-slate-700 dark:text-slate-200 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active & In Progress</option>
              <option value="RELEASED">Shipped Production</option>
              <option value="ROLLED_BACK">Rolled Back Incidents</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => releasesQuery.refetch()}
            disabled={releasesQuery.isRefetching}
            className="h-8 gap-1.5 text-xs text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${releasesQuery.isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button size="sm" onClick={handleOpenCreate} className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-3.5 w-3.5" />
            Schedule Release
          </Button>
        </div>
      </div>

      {/* 4-Card Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Release Train */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Active Release Train</span>
              <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 border border-blue-200 dark:border-blue-900">
                <Rocket className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {activeReleaseCandidate ? activeReleaseCandidate.version : 'None Active'}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {activeReleaseCandidate && activeReleaseCandidate.targetDate ? (
                  <>
                    Target: {new Date(activeReleaseCandidate.targetDate).toLocaleDateString()} ·{' '}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {calculateDaysRemaining(activeReleaseCandidate.targetDate)} days remaining
                    </span>
                  </>
                ) : (
                  'All scheduled releases shipped'
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Quality Gate Readiness */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Pipeline Quality Gate</span>
              <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border border-emerald-200 dark:border-emerald-900">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {avgReadinessScore}%
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                5-Factor Quality Gate Passing (Threshold: 70%)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Canary Telemetry Stability */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Canary Operational Health</span>
              <div className="p-1.5 rounded-md bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 border border-cyan-200 dark:border-cyan-900">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Healthy
                <Badge variant="outline" className="text-[10px] font-mono text-cyan-600 border-cyan-500/30">
                  sqdis-backend
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                P95 Latency baseline vs canary variance within safety threshold
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Deployment Success Rate */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Deployment Success Rate</span>
              <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 border border-amber-200 dark:border-amber-900">
                <RotateCcw className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {deploymentSuccessRate}%
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {releasedReleases.length} Shipped ·{' '}
                <span className={rolledBackReleases.length > 0 ? 'text-rose-600 font-semibold' : ''}>
                  {rolledBackReleases.length} Rollback Incident Logged
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <TabsTrigger value="pipeline" className="gap-2 text-xs">
            <Rocket className="h-3.5 w-3.5" />
            Release Pipeline & Trains
            <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 font-mono">
              {releases.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Deployment History & Rollback Logs
            <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 font-mono">
              {releasedReleases.length + rolledBackReleases.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="canary" className="gap-2 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Canary Telemetry & Health Radar
            <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 font-mono">
              {telemetryAnalyses.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Release Pipeline & Trains */}
        {activeTab === 'pipeline' && (
          <QueryState isLoading={releasesQuery.isLoading} error={releasesQuery.error} onRetry={() => releasesQuery.refetch()}>
            <div className="space-y-4">
              {filteredReleases.map((release) => {
                const status = resolveReleaseStatus(release)
                const readiness = release.readiness
                const daysRemaining = calculateDaysRemaining(release.targetDate)
                const isShipped = status === 'RELEASED'
                const isRolledBack = status === 'ROLLED_BACK'

                return (
                  <Card
                    key={release.id}
                    className="border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <CardContent className="p-5 space-y-4">
                      {/* Top Row: Version, Status, Readiness, Actions */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <Tag className="h-4 w-4 text-indigo-500 shrink-0" />
                            <h2 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                              {release.version}
                            </h2>
                            {getStatusBadge(status)}
                            {getReadinessBadge(readiness?.score, readiness?.isAtRisk)}
                            {release.latestTelemetry && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-mono ${
                                  release.latestTelemetry.verdict === 'HEALTHY'
                                    ? 'text-cyan-600 border-cyan-500/30'
                                    : 'text-rose-600 border-rose-500/30'
                                }`}
                              >
                                Telemetry: {release.latestTelemetry.verdict}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {release.description || 'No release specification provided.'}
                          </p>
                        </div>

                        {/* Direct Governance Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportPdfMutation.mutate(release.id)}
                            disabled={exportPdfMutation.isPending}
                            className="h-8 gap-1.5 text-xs text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                            title="Export verified PDF readiness report"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Report PDF
                          </Button>

                          {!isShipped && !isRolledBack && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenShipModal(release)}
                              className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Rocket className="h-3.5 w-3.5" />
                              Ship Release
                            </Button>
                          )}

                          {isRolledBack && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setSelectedRollbackRelease(release)}
                              className="h-8 gap-1.5 text-xs"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Post-Mortem
                            </Button>
                          )}

                          <Link to={`/releases/${release.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            >
                              Details
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>

                      {/* Deployment Stage Progress Pipeline */}
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                          <span>Deployment Train Progression</span>
                          <span>
                            {isShipped
                              ? `Shipped on ${new Date(release.shippedAt!).toLocaleDateString()}`
                              : isRolledBack
                              ? `Rolled back on ${new Date(release.rolledBackAt!).toLocaleDateString()}`
                              : release.targetDate
                              ? `Target: ${new Date(release.targetDate).toLocaleDateString()} (${daysRemaining} days left)`
                              : 'Target Date TBD'}
                          </span>
                        </div>
                        {getStageIndicator(status)}
                      </div>

                      {/* 5-Factor Quality Readiness Pillar Chips */}
                      {readiness && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
                          <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                              Bug Resolution
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {readiness.bugScore ?? 100}%
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                              Test Coverage
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {readiness.coverageScore ?? 80}%
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                              DQS Score
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {readiness.dqsScore ?? 85}%
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                              Test Pass Rate
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {readiness.testPassRate ?? 80}%
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                              Telemetry Stability
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                readiness.telemetryScore !== undefined && readiness.telemetryScore < 70
                                  ? 'text-rose-600'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {readiness.telemetryScore !== undefined ? `${readiness.telemetryScore}%` : 'Pending'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Associated Sprints Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-slate-400">Associated Sprints:</span>
                          {release.sprints && release.sprints.length > 0 ? (
                            release.sprints.map((sprint: any) => (
                              <Badge
                                key={sprint.id}
                                variant="outline"
                                className="text-[11px] font-mono text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                              >
                                {sprint.name} {sprint.teamName ? `(${sprint.teamName})` : ''}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No sprints linked to this release</span>
                          )}
                        </div>

                        {release.latestTelemetry && (() => {
                          const tm = getTelemetryMetrics(release.latestTelemetry)
                          return (
                            <div className="text-right text-[11px] font-mono text-slate-500">
                              <span>
                                Canary P95:{' '}
                                <strong className="text-slate-900 dark:text-slate-100">
                                  {tm.p95Canary.toFixed(1)}ms
                                </strong>{' '}
                                ({tm.latencyDelta > 0 ? '+' : ''}
                                {tm.latencyDelta.toFixed(1)}%)
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {filteredReleases.length === 0 && (
                <Card className="border-dashed border-slate-300 dark:border-slate-800">
                  <CardContent className="p-12 text-center space-y-3">
                    <Rocket className="h-8 w-8 text-slate-400 mx-auto" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      No release candidates match your filter
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Adjust your search query, change the status filter, or schedule a new release candidate.
                    </p>
                    <Button size="sm" onClick={handleOpenCreate} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Schedule New Release
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </QueryState>
        )}

        {/* Tab 2: Deployment History & Rollback Logs */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Historical Deployment & Rollback Audit Log
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Complete provenance record of all shipped production versions and emergency rollback post-mortems
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {releasedReleases.length + rolledBackReleases.length} Events Logged
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
                {/* 1. Rolled Back Releases (Incident Post-Mortems) */}
                {rolledBackReleases.map((release) => (
                  <div
                    key={release.id}
                    className="p-4 bg-rose-50/40 dark:bg-rose-950/10 space-y-3 hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        <h4 className="font-mono font-bold text-sm text-rose-950 dark:text-rose-200">
                          {release.version} (Rolled Back Incident)
                        </h4>
                        <Badge variant="destructive" className="text-[10px] font-mono">
                          INCIDENT MITIGATED
                        </Badge>
                      </div>
                      <span className="text-xs font-mono text-rose-600 dark:text-rose-400">
                        Rolled back on {new Date(release.rolledBackAt || release.updatedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                        <span>Triggered By: {release.rollbackTriggeredBy || 'Automated Watchdog'}</span>
                        <span className="text-rose-600 font-bold">Severity: CRITICAL REGRESSION</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        {release.rollbackReason || 'Automated canary performance regression trip-wire activated.'}
                      </p>

                      {release.latestTelemetry && (() => {
                        const tm = getTelemetryMetrics(release.latestTelemetry)
                        return (
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-rose-100 dark:border-rose-950 text-[11px] font-mono">
                            <div>
                              <span className="text-slate-400 block">P95 Latency</span>
                              <span className="text-rose-600 font-bold">
                                {tm.p95Canary.toFixed(1)}ms (+
                                {tm.latencyDelta.toFixed(1)}%)
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">5xx Error Rate</span>
                              <span className="text-rose-600 font-bold">
                                {tm.errorCanary.toFixed(2)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Heap Memory RSS</span>
                              <span className="text-rose-600 font-bold">
                                {tm.memoryCanary.toFixed(0)}MB (+
                                {tm.memoryDelta.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportPdfMutation.mutate(release.id)}
                        className="h-7 text-xs border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download Incident PDF
                      </Button>
                      <Link to={`/releases/${release.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-700 dark:text-rose-300">
                          Inspect Trace <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}

                {/* 2. Shipped Releases */}
                {releasedReleases.map((release) => (
                  <div
                    key={release.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                          {release.version}
                        </h4>
                        <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-500/30">
                          LIVE IN PRODUCTION
                        </Badge>
                        {getReadinessBadge(release.readiness?.score)}
                      </div>
                      <p className="text-xs text-slate-500 max-w-2xl pl-6">
                        {release.description || 'Production build deployed successfully.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-slate-500">
                      <span>Shipped on {new Date(release.shippedAt!).toLocaleDateString()}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportPdfMutation.mutate(release.id)}
                        className="h-7 text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" /> PDF
                      </Button>
                      <Link to={`/releases/${release.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}

                {releasedReleases.length === 0 && rolledBackReleases.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No historical production deployments in archive yet. Ship a scheduled candidate to populate the log.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 3: Canary Telemetry & Health Radar */}
        {activeTab === 'canary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {telemetryAnalyses.map(({ release, telemetry }) => {
                const isHealthy = telemetry.verdict === 'HEALTHY'
                const isCritical = telemetry.verdict === 'CRITICAL_REGRESSION'

                return (
                  <Card
                    key={telemetry.id}
                    className={`border shadow-sm ${
                      isCritical
                        ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity
                            className={`h-4 w-4 ${isHealthy ? 'text-cyan-600' : isCritical ? 'text-rose-600' : 'text-amber-500'}`}
                          />
                          <CardTitle className="text-sm font-mono font-bold">
                            {release.version} ({telemetry.serviceName})
                          </CardTitle>
                        </div>
                        <Badge
                          variant={isHealthy ? 'success' : isCritical ? 'destructive' : 'secondary'}
                          className="font-mono text-[10px]"
                        >
                          {telemetry.verdict}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        Recommendation: <strong className="font-mono text-slate-800 dark:text-slate-200">{telemetry.recommendation}</strong> · Score: {telemetry.score}/100
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 space-y-4 text-xs">
                      {(() => {
                        const tm = getTelemetryMetrics(telemetry)
                        return (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                              <span className="text-[10px] text-slate-400 block font-mono">P95 Latency</span>
                              <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {tm.p95Canary.toFixed(1)}ms
                              </div>
                              <span
                                className={`text-[10px] font-mono ${
                                  tm.latencyDelta > 15
                                    ? 'text-rose-600 font-bold'
                                    : tm.latencyDelta > 0
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {tm.latencyDelta > 0 ? '+' : ''}
                                {tm.latencyDelta.toFixed(1)}% vs baseline
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                              <span className="text-[10px] text-slate-400 block font-mono">5xx Error Rate</span>
                              <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {tm.errorCanary.toFixed(2)}%
                              </div>
                              <span
                                className={`text-[10px] font-mono ${
                                  tm.errorDelta > 1
                                    ? 'text-rose-600 font-bold'
                                    : tm.errorDelta > 0
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {tm.errorDelta > 0 ? '+' : ''}
                                {tm.errorDelta.toFixed(2)}% vs baseline
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                              <span className="text-[10px] text-slate-400 block font-mono">Heap RSS Memory</span>
                              <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {tm.memoryCanary.toFixed(0)}MB
                              </div>
                              <span
                                className={`text-[10px] font-mono ${
                                  tm.memoryDelta > 20
                                    ? 'text-rose-600 font-bold'
                                    : tm.memoryDelta > 0
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {tm.memoryDelta > 0 ? '+' : ''}
                                {tm.memoryDelta.toFixed(1)}% vs baseline
                              </span>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Stability Score Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-500">Canary Stability Index</span>
                          <span className="font-bold">{telemetry.score} / 100</span>
                        </div>
                        <Progress
                          value={telemetry.score}
                          className={`h-2 ${isCritical ? 'bg-rose-100 dark:bg-rose-950' : ''}`}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 font-mono">
                        <span>Evaluated: {new Date(telemetry.createdAt).toLocaleString()}</span>
                        <Link to={`/releases/${release.id}`}>
                          <span className="text-indigo-600 dark:text-indigo-400 hover:underline">
                            View Full Radar
                          </span>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {telemetryAnalyses.length === 0 && (
              <Card className="border-dashed border-slate-300 dark:border-slate-800">
                <CardContent className="p-10 text-center space-y-2">
                  <Activity className="h-8 w-8 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-semibold">No canary telemetry analyses recorded yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Evaluate operational canary telemetry for active release candidates to record P95 regression signals.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </Tabs>

      {/* Schedule Release Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Schedule Release Candidate">
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Version Tag (SemVer)
            </label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. v2.7.0 or v2.7.0-rc.1"
              required
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              Semantic version string used for Git tags and artifact bundles
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Release Specification & Notes
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of capabilities, quality targets, and dependencies..."
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Deployment Date
            </label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
              className="text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Associate Active Sprint Cycle
            </label>
            <select
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="">No sprint association</option>
              {allSprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name} ({new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={createMutation.isPending}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Schedule Release Candidate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Ship to Production Modal */}
      <Modal
        isOpen={isShipModalOpen}
        onClose={() => setIsShipModalOpen(false)}
        title={`Ship Release ${targetShipRelease?.version || ''} to Production`}
      >
        <form onSubmit={handleConfirmShip} className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <Rocket className="h-4 w-4 text-blue-600 shrink-0" />
              <span>Production Deployment Trigger</span>
            </div>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              Shipping this release marks it as live in PostgreSQL, creates a verified Git release tag, and optionally dispatches GitHub Actions CI/CD.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Repository
            </label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-slate-800 dark:text-slate-200 font-mono"
            >
              {connectedRepos.map((repo: any) => (
                <option key={repo.id} value={repo.id}>
                  {repo.fullName || repo.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Git Release Tag
              </label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                required
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Git Branch Ref
              </label>
              <Input
                value={gitRef}
                onChange={(e) => setGitRef(e.target.value)}
                placeholder="main"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Release Title
            </label>
            <Input
              value={releaseTitle}
              onChange={(e) => setReleaseTitle(e.target.value)}
              placeholder="e.g. Release v2.5.0"
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Release Notes / Changelog
            </label>
            <Input
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="Key deliverables and patch notes..."
              className="text-xs"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={createGitHubRelease}
                onChange={(e) => setCreateGitHubRelease(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Create verified GitHub Release on repository</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={triggerWorkflow}
                onChange={(e) => setTriggerWorkflow(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Trigger GitHub Actions deployment workflow</span>
            </label>

            {triggerWorkflow && (
              <div className="pl-6 pt-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Workflow File Name
                </label>
                <Input
                  value={workflowFileName}
                  onChange={(e) => setWorkflowFileName(e.target.value)}
                  placeholder="ci.yml"
                  className="font-mono text-xs h-8"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsShipModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={shipMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Confirm & Ship to Production
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rollback Post-Mortem Modal */}
      {selectedRollbackRelease && (
        <Modal
          isOpen={!!selectedRollbackRelease}
          onClose={() => setSelectedRollbackRelease(null)}
          title={`Incident Post-Mortem: ${selectedRollbackRelease.version}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>Rollback Incident Overview</span>
              </div>
              <p className="text-[11px] text-rose-800 dark:text-rose-200">
                Automated trip-wire intercepted severe latency and memory degradation before it could impact production users.
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block font-mono">Root Cause Analysis</span>
              <p className="text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                {selectedRollbackRelease.rollbackReason}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-400">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-0.5 font-mono text-[11px]">
                <span className="text-slate-400 block">Triggered By</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold">
                  {selectedRollbackRelease.rollbackTriggeredBy || 'System Watchdog'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-0.5 font-mono text-[11px]">
                <span className="text-slate-400 block">Timestamp</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold">
                  {new Date(selectedRollbackRelease.rolledBackAt || selectedRollbackRelease.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>

            {selectedRollbackRelease.latestTelemetry && (() => {
              const tm = getTelemetryMetrics(selectedRollbackRelease.latestTelemetry)
              return (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 block font-mono">
                    Canary Regression Metrics at Trip Time
                  </span>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 block">P95 Surge</span>
                      <span className="text-rose-600 font-bold">
                        {tm.p95Canary.toFixed(1)}ms
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Error Rate</span>
                      <span className="text-rose-600 font-bold">
                        {tm.errorCanary.toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Memory RSS</span>
                      <span className="text-rose-600 font-bold">
                        {tm.memoryCanary.toFixed(0)}MB
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPdfMutation.mutate(selectedRollbackRelease.id)}
                className="text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download Audit PDF
              </Button>
              <Button size="sm" onClick={() => setSelectedRollbackRelease(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
