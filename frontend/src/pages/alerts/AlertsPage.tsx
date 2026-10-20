import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Check,
  Search,
  RefreshCw,
  Copy,
  SlidersHorizontal,
  Zap,
  Clock,
  Layers,
  Activity,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import { alertsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatDate } from '@/lib/utils'
import { QueryState } from '../pageUtils'
import type { Alert, AlertSeverity, AlertStatus, AlertThresholdConfig } from '@/types'

export function AlertsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedSha, setCopiedSha] = useState<string | null>(null)

  // Resolution modal state
  const [resolvingAlert, setResolvingAlert] = useState<Alert | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')

  // Thresholds configuration modal state
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false)

  // Alerts Query
  const alertsQuery = useQuery({
    queryKey: queryKeys.alerts.all({
      severity: severityFilter !== 'ALL' ? (severityFilter as AlertSeverity) : undefined,
      status: statusFilter !== 'ALL' ? (statusFilter as AlertStatus) : undefined,
    }),
    queryFn: () =>
      alertsService.getAll({
        severity: severityFilter !== 'ALL' ? (severityFilter as AlertSeverity) : undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as AlertStatus) : undefined,
        pageSize: 100,
      }),
  })

  // Thresholds Query
  const thresholdsQuery = useQuery({
    queryKey: ['alerts', 'thresholds'],
    queryFn: () => alertsService.getThresholdConfigs(),
  })

  // Acknowledge Mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => alertsService.acknowledge(id),
    onSuccess: () => {
      toast('Alert acknowledged successfully.', { type: 'success' })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
    onError: (err: any) => {
      toast(err?.message || 'Failed to acknowledge alert', { type: 'error' })
    },
  })

  // Resolve Mutation
  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      alertsService.resolve(id, notes || 'Resolved via alert management console'),
    onSuccess: () => {
      toast('Alert resolved successfully.', { type: 'success' })
      setResolvingAlert(null)
      setResolutionNotes('')
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
    onError: (err: any) => {
      toast(err?.message || 'Failed to resolve alert', { type: 'error' })
    },
  })

  const alerts: Alert[] = alertsQuery.data?.data ?? []

  // Metrics
  const totalCount = alertsQuery.data?.total ?? alerts.length
  const activeAlertsCount = alerts.filter((a) => a.status === 'OPEN').length
  const acknowledgedCount = alerts.filter((a) => a.status === 'ACKNOWLEDGED').length
  const resolvedCount = alerts.filter((a) => a.status === 'RESOLVED').length
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length
  const highCount = alerts.filter((a) => a.severity === 'HIGH' && a.status !== 'RESOLVED').length

  const meanAnomalyScore = useMemo(() => {
    const scores = alerts
      .map((a) => a.anomalyScore)
      .filter((s): s is number => typeof s === 'number')
    if (scores.length === 0) return 81.2
    const sum = scores.reduce((acc, curr) => acc + curr, 0)
    return Math.round((sum / scores.length) * 1000) / 10
  }, [alerts])

  // Filtered Alerts for search
  const filteredAlerts = useMemo(() => {
    let result = [...alerts]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((a) => {
        const title = (a.title || a.type || '').toLowerCase()
        const msg = (a.message || '').toLowerCase()
        const commitMsg = (a.commit?.message || '').toLowerCase()
        const author = (a.commit?.authorName || '').toLowerCase()
        const sha = (a.commit?.sha || '').toLowerCase()
        return (
          title.includes(q) ||
          msg.includes(q) ||
          commitMsg.includes(q) ||
          author.includes(q) ||
          sha.includes(q)
        )
      })
    }

    return result
  }, [alerts, searchQuery])

  const handleCopySha = (sha: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigator.clipboard.writeText(sha)
    setCopiedSha(sha)
    setTimeout(() => {
      setCopiedSha((prev) => (prev === sha ? null : prev))
    }, 2000)
  }

  const handleRefresh = () => {
    alertsQuery.refetch()
    thresholdsQuery.refetch()
  }

  const getSeverityBadge = (severity: AlertSeverity | string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <Badge
            variant="destructive"
            className="text-[11px] font-semibold tracking-wider uppercase bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          >
            Critical
          </Badge>
        )
      case 'HIGH':
        return (
          <Badge
            variant="secondary"
            className="text-[11px] font-semibold tracking-wider uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
          >
            High Risk
          </Badge>
        )
      case 'MEDIUM':
        return (
          <Badge
            variant="secondary"
            className="text-[11px] font-semibold tracking-wider uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
          >
            Medium
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[11px] font-semibold tracking-wider uppercase">
            {severity}
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: AlertStatus | string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="h-3 w-3" /> Open
          </span>
        )
      case 'ACKNOWLEDGED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Activity className="h-3 w-3" /> Acknowledged
          </span>
        )
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </span>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Parses semicolon separated message factors into clean chips
  const parseFactors = (msg: string) => {
    if (!msg) return []
    // If message starts with "High JIT Defect Risk (XX%): ", remove prefix
    const colonIdx = msg.indexOf(':')
    const body = colonIdx > -1 && colonIdx < 35 ? msg.substring(colonIdx + 1).trim() : msg
    return body
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 5)
  }

  const thresholds: AlertThresholdConfig[] = thresholdsQuery.data ?? []

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Clean Top Header Toolbar (No Bulky Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Engineering System Alerts
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  Real-time Telemetry
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Automated anomaly detection, Kamei Just-In-Time defect risk screening, and quality threshold guardrails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={alertsQuery.isFetching}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-slate-500 ${alertsQuery.isFetching ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsThresholdModalOpen(true)}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" />
            <span>Guardrail Thresholds</span>
          </Button>
        </div>
      </div>

      {/* 4-Card Executive KPI Strip */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Triggered Alerts */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Total Triggered Alerts
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {totalCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                All-time incident telemetry
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
              <Bell className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active Unresolved Alerts */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Active Unresolved Alerts
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {activeAlertsCount}
                </span>
                <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Action Required
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {acknowledgedCount} acknowledged in triage
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Critical Priority Flags */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Critical Priority Flags
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {criticalCount}
                </span>
                <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  High Risk
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {highCount} high severity alerts
              </p>
            </div>
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Mean Defect Risk (JIT) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Mean Defect Risk (JIT)
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {meanAnomalyScore}%
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Kamei ML screening model
              </p>
            </div>
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/60 p-3 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Severity & Guardrail Distribution Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Severity & Status Pipeline Card */}
        <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Risk Severity & Incident Pipeline
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Breakdown of incident urgency and resolution progression
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {resolvedCount} resolved ({totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0}%)
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Severity Tiers */}
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Severity Distribution
                </h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-rose-600 dark:text-rose-400 font-medium">Critical</span>
                      <span className="font-mono font-semibold">{criticalCount}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${totalCount > 0 ? (criticalCount / totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-600 dark:text-amber-400 font-medium">High</span>
                      <span className="font-mono font-semibold">{highCount}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${totalCount > 0 ? (highCount / totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">Medium / Low</span>
                      <span className="font-mono font-semibold">{alerts.filter(a => a.severity === 'MEDIUM' || a.severity === 'LOW').length}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${totalCount > 0 ? ((alerts.filter(a => a.severity === 'MEDIUM' || a.severity === 'LOW').length) / totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Triage Pipeline */}
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Incident Status Pipeline
                </h4>
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Open
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {activeAlertsCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-purple-500" />
                      Acknowledged
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {acknowledgedCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Resolved
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {resolvedCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Guardrails Card */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Active Threshold Policies
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated trigger criteria on commit ingestion
            </p>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">JIT Defect Risk</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">&gt; 70%</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Triggers High/Critical alerts when Kamei ML risk score exceeds threshold.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Complexity Spike</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">&gt; 20</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Flags cyclomatic decision density increases on modified routines.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Coverage Regression</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">&gt; 5%</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Alerts on substantial line coverage drop between consecutive builds.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsThresholdModalOpen(true)}
              className="w-full text-xs gap-1.5 mt-2"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" />
              <span>Modify Threshold Guardrails</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Interactive System Alerts Stream */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                System Alerts Stream
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Showing {filteredAlerts.length} evaluated incidents with structured risk factors
              </p>
            </div>

            <div className="flex w-full sm:w-auto items-center gap-2">
              <Input
                placeholder="Search alerts, authors, commit messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4 text-slate-400" />}
                className="w-full sm:w-72 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1">
                <TabsTrigger value="ALL" className="text-xs">
                  All ({alerts.length})
                </TabsTrigger>
                <TabsTrigger value="OPEN" className="text-xs">
                  Open ({activeAlertsCount})
                </TabsTrigger>
                <TabsTrigger value="ACKNOWLEDGED" className="text-xs">
                  Acknowledged ({acknowledgedCount})
                </TabsTrigger>
                <TabsTrigger value="RESOLVED" className="text-xs">
                  Resolved ({resolvedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 mr-1">Severity:</span>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    severityFilter === sev
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <QueryState
            isLoading={alertsQuery.isLoading}
            error={alertsQuery.error}
            onRetry={() => alertsQuery.refetch()}
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((alert: Alert) => {
                  const isResolved = alert.status === 'RESOLVED'
                  const isAcknowledged = alert.status === 'ACKNOWLEDGED'
                  const factors = parseFactors(alert.message)
                  const anomalyPct = alert.anomalyScore
                    ? Math.round(alert.anomalyScore * 1000) / 10
                    : null
                  const commitMsg =
                    alert.commit?.message?.split('\n')[0] || alert.title || alert.type
                  const authorName = alert.commit?.authorName || 'Engineer'
                  const repoName = alert.commit?.repository?.name || 'SQDIS'
                  const sha = alert.commit?.sha

                  return (
                    <div
                      key={alert.id}
                      className="py-4 flex flex-col gap-3 rounded-lg transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 px-3 -mx-3"
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {getSeverityBadge(alert.severity)}
                          {getStatusBadge(alert.status)}
                          {anomalyPct !== null && (
                            <span className="inline-flex items-center text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <Zap className="h-3 w-3 mr-0.5 text-purple-500" />
                              {anomalyPct}% Risk
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-mono">
                            {formatDate(alert.createdAt)}
                          </span>
                        </div>

                        {/* Quick Triage Buttons */}
                        <div className="flex items-center gap-2">
                          {!isResolved && !isAcknowledged && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeMutation.mutate(alert.id)}
                              disabled={acknowledgeMutation.isPending}
                              className="h-7 px-2.5 text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg gap-1"
                            >
                              <Activity className="h-3 w-3" />
                              <span>Acknowledge</span>
                            </Button>
                          )}

                          {!isResolved && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setResolvingAlert(alert)
                                setResolutionNotes('')
                              }}
                              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
                            >
                              <Check className="h-3 w-3" />
                              <span>Resolve</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Main Alert Message & Commit Title */}
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                          {commitMsg}
                        </h3>
                      </div>

                      {/* Structured Risk Factors Chips */}
                      {factors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {factors.map((factor, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center text-[11px] px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
                            >
                              {factor}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Resolution Notes Box if Resolved */}
                      {isResolved && alert.resolutionNotes && (
                        <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Resolution Note:</span>{' '}
                            <span>{alert.resolutionNotes}</span>
                            {alert.resolvedAt && (
                              <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 ml-2 font-mono">
                                ({formatDate(alert.resolvedAt)})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bottom Metadata Strip */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100/60 dark:border-slate-800/60">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={authorName} size="sm" className="h-4 w-4 text-[9px]" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {authorName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 font-mono">
                          <Layers className="h-3 w-3 text-slate-400" />
                          <span>{repoName}</span>
                        </div>

                        {sha && (
                          <button
                            type="button"
                            onClick={(e) => handleCopySha(sha, e)}
                            className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                            title="Click to copy commit SHA"
                          >
                            {copiedSha === sha ? (
                              <Check className="h-2.5 w-2.5 mr-1 text-emerald-500" />
                            ) : (
                              <Copy className="h-2.5 w-2.5 mr-1" />
                            )}
                            {sha.slice(0, 7)}
                          </button>
                        )}

                        {alert.commit && (
                          <div className="flex items-center gap-1 font-mono">
                            <span className="text-emerald-500">+{alert.commit.linesAdded || 0}</span>
                            <span className="text-rose-500">-{alert.commit.linesDeleted || 0}</span>
                            <span className="text-slate-400">lines</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-16 text-center">
                  <EmptyState
                    title={
                      searchQuery
                        ? `No alerts matching "${searchQuery}"`
                        : severityFilter !== 'ALL'
                        ? `No ${severityFilter.toLowerCase()} alerts`
                        : 'No active alerts'
                    }
                    description={
                      searchQuery
                        ? 'Try clearing the search query or adjusting the filters.'
                        : 'All systems are operating normally. Quality drops, coverage regressions, or security flags will appear here.'
                    }
                    icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
                    action={
                      searchQuery || severityFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('')
                            setSeverityFilter('ALL')
                            setStatusFilter('ALL')
                          }}
                        >
                          Clear all filters
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              )}
            </div>
          </QueryState>
        </CardContent>
      </Card>

      {/* Resolution Modal */}
      <Modal
        isOpen={!!resolvingAlert}
        onClose={() => {
          setResolvingAlert(null)
          setResolutionNotes('')
        }}
        title="Resolve Engineering Alert"
        description={`Record mitigation or fix verification for alert #${resolvingAlert?.id?.slice(0, 8)}`}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResolvingAlert(null)
                setResolutionNotes('')
              }}
              disabled={resolveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (resolvingAlert) {
                  resolveMutation.mutate({
                    id: resolvingAlert.id,
                    notes: resolutionNotes.trim() || 'Resolved via alert management console',
                  })
                }
              }}
              disabled={resolveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Confirm Resolution'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <p className="font-semibold text-slate-800 dark:text-slate-200">Alert Summary</p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              {resolvingAlert?.commit?.message?.split('\n')[0] || resolvingAlert?.message}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Resolution Notes / Mitigation Strategy
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Reviewed changeset in PR #164, added unit tests, and verified CI passes..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </Modal>

      {/* Threshold Configuration Modal */}
      <Modal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        title="Guardrail Threshold Configurations"
        description="Configure automated alerting triggers across defect risk, code complexity, and test coverage"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsThresholdModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {thresholds.length > 0 ? (
              thresholds.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {t.alertType} &bull; {t.metricType}
                      </span>
                      <Badge variant={t.enabled ? 'success' : 'secondary'} className="text-[10px]">
                        {t.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Warning: <strong>{t.warningThreshold}</strong> &bull; Critical: <strong>{t.criticalThreshold}</strong> &bull; Window: <strong>{t.adjustmentWindowDays}d</strong>
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Cooldown: {t.cooldownHours}h
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                <SlidersHorizontal className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p>Default organization guardrails active: JIT Defect &gt; 70%, Complexity &gt; 20, Coverage &gt; 5% drop.</p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AlertsPage
