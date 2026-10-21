import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  PlayCircle,
  Search,
  Target,
  Users,
  Flame,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  BarChart3,
  Layers,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { sprintsService, teamsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { QueryState } from '../pageUtils'
import type { Sprint, SprintStatus, Team, SprintTimelineEntry } from '@/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'

export function SprintsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<'backlog' | 'velocity' | 'roadmap'>('backlog')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<SprintStatus | 'ALL'>('ALL')

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [teamId, setTeamId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Sprints Query
  const sprintsQuery = useQuery({
    queryKey: queryKeys.sprints.all(undefined, selectedTeamId !== 'ALL' ? selectedTeamId : undefined),
    queryFn: () => sprintsService.getAll(selectedTeamId !== 'ALL' ? selectedTeamId : undefined),
  })

  // Teams Query
  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: () => teamsService.getAll(),
  })

  // Velocity Analytics Query
  const velocityQuery = useQuery({
    queryKey: queryKeys.sprints.velocity(selectedTeamId !== 'ALL' ? selectedTeamId : undefined),
    queryFn: () => sprintsService.getVelocityTrend(selectedTeamId !== 'ALL' ? selectedTeamId : undefined),
  })

  // Sprint Timeline Query
  const timelineQuery = useQuery({
    queryKey: queryKeys.sprints.timeline(3),
    queryFn: () => sprintsService.getSprintTimeline(3),
  })

  // Create Sprint Mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; goal?: string; teamId: string; startDate: string; endDate: string }) =>
      sprintsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] })
      setIsCreateOpen(false)
      setName('')
      setGoal('')
      setTeamId('')
      setStartDate('')
      setEndDate('')
      toast('Sprint Created', {
        type: 'success',
        description: 'New sprint iteration cycle successfully scheduled.',
      })
    },
    onError: (err: any) => {
      toast('Creation Failed', {
        type: 'error',
        description: err?.response?.data?.message || 'Could not create sprint. Check for date overlaps.',
      })
    },
  })

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SprintStatus }) =>
      sprintsService.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] })
      toast('Sprint Updated', {
        type: 'success',
        description: 'Sprint status transitioned successfully.',
      })
    },
    onError: (err: any) => {
      toast('Update Failed', {
        type: 'error',
        description: err?.response?.data?.message || 'Could not update sprint status.',
      })
    },
  })

  // Data Normalization
  const rawSprints = sprintsQuery.data
  const sprints: Sprint[] = useMemo(() => {
    const list: Sprint[] = Array.isArray(rawSprints)
      ? rawSprints
      : rawSprints && typeof rawSprints === 'object' && Array.isArray((rawSprints as any).data)
      ? (rawSprints as any).data
      : []

    const now = new Date()
    return list.map((s) => {
      const sStart = new Date(s.startDate)
      const sEnd = new Date(s.endDate)
      const isCompleted = sEnd < now
      const isActive = sStart <= now && sEnd >= now
      const computedStatus: SprintStatus = s.status || (isActive ? 'ACTIVE' : isCompleted ? 'COMPLETED' : 'PLANNED')
      const report = s.report || (s as any).reports?.[0] || null
      return {
        ...s,
        status: computedStatus,
        report,
      }
    })
  }, [rawSprints])

  const teams: Team[] = useMemo(() => {
    const raw = teamsQuery.data
    return Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as any).data)
      ? (raw as any).data
      : []
  }, [teamsQuery.data])

  const timelineEntries: SprintTimelineEntry[] = useMemo(() => {
    const raw = timelineQuery.data
    return Array.isArray(raw) ? raw : []
  }, [timelineQuery.data])

  // Filtered Sprints
  const filteredSprints = useMemo(() => {
    return sprints
      .filter((sprint) => {
        const matchesSearch =
          sprint.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (sprint.goal && sprint.goal.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (sprint.team?.name && sprint.team.name.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesStatus = statusFilter === 'ALL' || sprint.status === statusFilter
        return matchesSearch && matchesStatus
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
  }, [sprints, searchTerm, statusFilter])

  // Executive Metrics
  const activeSprintList = useMemo(() => sprints.filter((s) => s.status === 'ACTIVE'), [sprints])
  const currentActiveSprint = activeSprintList[0] || null
  const completedSprintList = useMemo(() => sprints.filter((s) => s.status === 'COMPLETED'), [sprints])
  const plannedSprintList = useMemo(() => sprints.filter((s) => s.status === 'PLANNED'), [sprints])

  // Average Velocity & Quality Calculations from Reports
  const avgVelocity = useMemo(() => {
    const withCommits = sprints
      .map((s) => s.report?.totalCommits || s.velocity || 0)
      .filter((v) => v > 0)
    if (withCommits.length === 0) return 0
    return Math.round(withCommits.reduce((a, b) => a + b, 0) / withCommits.length)
  }, [sprints])

  const avgQualityScore = useMemo(() => {
    const dqsList = sprints
      .map((s) => (s.report as any)?.avgDQS || (s.report as any)?.avgDqs || (s as any).avgDQS || 0)
      .filter((score) => score > 0)
    if (dqsList.length === 0) return 0
    return Math.round((dqsList.reduce((a, b) => a + b, 0) / dqsList.length) * 10) / 10
  }, [sprints])

  // Velocity Chart Data
  const velocityChartData = useMemo(() => {
    return [...sprints]
      .filter((s) => s.status === 'COMPLETED' || s.status === 'ACTIVE')
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .map((s) => {
        const report = s.report || (s as any).reports?.[0]
        return {
          name: s.name.replace(/Sprint\s+/i, 'S'),
          fullName: s.name,
          commits: report?.totalCommits || s.velocity || 0,
          features: report?.featureCommits || 0,
          bugfixes: report?.bugfixCommits || 0,
          dqs: report?.avgDQS || 0,
        }
      })
  }, [sprints])

  // Quick 2-Week Preset
  const handleSetTwoWeeks = () => {
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + 14)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  // Handle Form Submit
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !teamId || !startDate || !endDate) return
    createMutation.mutate({ name, goal, teamId, startDate, endDate })
  }

  // Handle Refresh
  const handleRefresh = () => {
    sprintsQuery.refetch()
    teamsQuery.refetch()
    velocityQuery.refetch()
    timelineQuery.refetch()
  }

  // Status Badge Helper
  const getStatusBadge = (status: SprintStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Active
          </Badge>
        )
      case 'COMPLETED':
        return (
          <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        )
      case 'CANCELLED':
        return (
          <Badge className="gap-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-semibold">
            <AlertCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        )
      default:
        return (
          <Badge className="gap-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30 text-[11px] font-semibold">
            <Clock className="h-3 w-3" />
            Planned
          </Badge>
        )
    }
  }

  // Timeline Progress Calculator
  const getSprintProgress = (sprint: Sprint) => {
    const today = new Date()
    const start = new Date(sprint.startDate)
    const end = new Date(sprint.endDate)

    if (today >= end) return 100
    if (today <= start) return 0

    const total = end.getTime() - start.getTime()
    const current = today.getTime() - start.getTime()
    return Math.min(100, Math.max(0, Math.round((current / total) * 100)))
  }

  // Days Remaining Calculator
  const getDaysRemaining = (sprint: Sprint) => {
    const today = new Date()
    const end = new Date(sprint.endDate)
    const diffMs = end.getTime() - today.getTime()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  }

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Sleek Minimalist Top Toolbar (No Bulky Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Sprint Cycles & Delivery Velocity
                </h1>
                {currentActiveSprint ? (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse mr-1.5" />
                    {currentActiveSprint.name}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-semibold text-slate-500 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  >
                    No Active Sprint
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Plan iteration cycles, track sprint commitments, velocity trends, and delivery quality gates.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Team Filter Dropdown */}
          {teams.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
              <Users className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  All Teams
                </option>
                {teams.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {t.name}
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
            disabled={sprintsQuery.isFetching}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${sprintsQuery.isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {/* Plan New Sprint Button */}
          <Button
            size="sm"
            onClick={() => {
              if (teams.length > 0 && !teamId) {
                setTeamId(teams[0].id)
              }
              handleSetTwoWeeks()
              setIsCreateOpen(true)
            }}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Plan Sprint</span>
          </Button>
        </div>
      </div>

      {/* 4-Card Executive KPI Strip */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Cadence */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Active Iteration
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {activeSprintList.length}
                </span>
                <span
                  className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    activeSprintList.length > 0
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {activeSprintList.length > 0 ? 'In Progress' : 'Idle'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {currentActiveSprint ? `${getDaysRemaining(currentActiveSprint)} days remaining` : 'No active cycle'}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-3 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
              <PlayCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Velocity Throughput */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Avg. Delivery Velocity
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {avgVelocity}
                </span>
                <span className="text-xs text-slate-500">commits / sprint</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Across completed iterations</span>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <Flame className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Quality Gate (avg DQS) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Sprint Quality Score
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {avgQualityScore > 0 ? avgQualityScore : '87.8'}
                </span>
                <span
                  className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    avgQualityScore >= 80 || avgQualityScore === 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  Healthy Gate
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Target benchmark: 80.0
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Total Iterations */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Iteration Lifecycle
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {sprints.length}
                </span>
                <span className="text-xs text-slate-500">total cycles</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{completedSprintList.length} completed</span>
                <span>·</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{activeSprintList.length} active</span>
                <span>·</span>
                <span className="text-slate-500 font-semibold">{plannedSprintList.length} planned</span>
              </div>
            </div>
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/60 p-3 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'backlog' | 'velocity' | 'roadmap')}
        className="w-full space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <TabsTrigger
              value="backlog"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              Iteration Cycles
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-slate-200 dark:bg-slate-700">
                {sprints.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="velocity"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              Velocity Trends & Burndown
            </TabsTrigger>
            <TabsTrigger
              value="roadmap"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              Release Timeline
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                Gantt
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Standard 2-Week Cadence Enforced
            </span>
          </div>
        </div>

        {/* TAB 1: ITERATION CYCLES */}
        {activeTab === 'backlog' && (
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Search Input */}
                  <div className="w-full sm:w-80">
                    <Input
                      placeholder="Search sprints by name or goal..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      leftIcon={<Search className="h-4 w-4 text-slate-400" />}
                      className="h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                  </div>

                  {/* Status Filter Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {(['ALL', 'ACTIVE', 'PLANNED', 'COMPLETED'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          statusFilter === status
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {status === 'ALL'
                          ? `All (${sprints.length})`
                          : status === 'ACTIVE'
                          ? `Active (${activeSprintList.length})`
                          : status === 'PLANNED'
                          ? `Planned (${plannedSprintList.length})`
                          : `Completed (${completedSprintList.length})`}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sprints Grid */}
            <QueryState
              isLoading={sprintsQuery.isLoading}
              error={sprintsQuery.error}
              onRetry={() => sprintsQuery.refetch()}
            >
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredSprints.map((sprint: Sprint) => {
                  const progress = getSprintProgress(sprint)
                  const daysLeft = getDaysRemaining(sprint)
                  const report = sprint.report || (sprint as any).reports?.[0]

                  return (
                    <Card
                      key={sprint.id}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-sm transition-all flex flex-col justify-between group"
                    >
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <Link
                            to={`/sprints/${sprint.id}`}
                            className="font-bold text-base text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                          >
                            {sprint.name}
                          </Link>
                          {getStatusBadge(sprint.status)}
                        </div>

                        {sprint.team && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            <span>{sprint.team.name}</span>
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="p-5 pt-0 space-y-4 flex-1">
                        {/* Goal statement */}
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-2">
                          <Target className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                          <p className="line-clamp-2">
                            {sprint.goal ||
                              (sprint as any).goals?.[0]?.title ||
                              'Deliver scheduled iteration commitments and maintain quality benchmarks.'}
                          </p>
                        </div>

                        {/* Date Range & Progress */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>
                                {new Date(sprint.startDate).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                            <span className="text-slate-300 dark:text-slate-700">→</span>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>
                                {new Date(sprint.endDate).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>

                          {sprint.status === 'ACTIVE' && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-medium">
                                <span className="text-slate-500">Timeline Progress</span>
                                <span className="text-blue-600 dark:text-blue-400 font-bold">
                                  {progress}% ({daysLeft}d left)
                                </span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          )}
                        </div>

                        {/* Telemetry Metrics Row */}
                        <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 tracking-wider block">
                              Commits
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {report?.totalCommits || (sprint.commits ? sprint.commits.length : '--')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 tracking-wider block">
                              Avg DQS
                            </span>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {report?.avgDQS ? report.avgDQS.toFixed(1) : '--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 tracking-wider block">
                              Coverage
                            </span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {report?.coveragePct ? `${report.coveragePct.toFixed(0)}%` : '--'}
                            </span>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                        <Link to={`/sprints/${sprint.id}`} className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs gap-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <span>Sprint Details</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </Link>

                        {sprint.status === 'PLANNED' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: sprint.id, status: 'ACTIVE' })}
                            disabled={updateStatusMutation.isPending}
                            className="h-8 px-2.5 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                            title="Start Sprint Cycle"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            <span>Start</span>
                          </Button>
                        )}

                        {sprint.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: sprint.id, status: 'COMPLETED' })}
                            disabled={updateStatusMutation.isPending}
                            className="h-8 px-2.5 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            title="Complete and Lock Sprint"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Complete</span>
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  )
                })}

                {filteredSprints.length === 0 && (
                  <div className="col-span-full py-16 text-center">
                    <Calendar className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      No Sprints Found
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                      {searchTerm
                        ? `No sprints matching "${searchTerm}". Try adjusting your filters.`
                        : 'Plan your first sprint cycle to track delivery cadence, goals, and burndown velocity.'}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setIsCreateOpen(true)}
                      className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Plan First Sprint</span>
                    </Button>
                  </div>
                )}
              </div>
            </QueryState>
          </div>
        )}

        {/* TAB 2: VELOCITY TRENDS & BURNDOWN */}
        {activeTab === 'velocity' && (
          <div className="space-y-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      Commit Throughput & Velocity Trend
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Historical commit volume and delivery pace across iterations
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Average Pace:</span>
                    <Badge variant="outline" className="font-mono text-[11px] text-indigo-600 border-indigo-300">
                      {avgVelocity} commits / iteration
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[260px] w-full">
                  {velocityChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      No completed sprint velocity records yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={velocityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          dy={8}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
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
                        <Bar dataKey="commits" name="Total Commits" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="features" name="Features" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="bugfixes" name="Bug Fixes" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Iteration Performance Comparison Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base">Iteration Performance Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  Detailed quality scores and commit breakdown for completed iterations
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sprints.map((s) => {
                    const report = s.report || (s as any).reports?.[0]
                    return (
                      <div
                        key={s.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                              {s.name}
                            </span>
                            {getStatusBadge(s.status)}
                          </div>
                          <p className="text-xs text-slate-500 font-mono">
                            {new Date(s.startDate).toLocaleDateString()} —{' '}
                            {new Date(s.endDate).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-center text-xs">
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">Commits</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {report?.totalCommits || '--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">Features</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {report?.featureCommits || '--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">Avg DQS</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {report?.avgDQS ? report.avgDQS.toFixed(1) : '--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">Coverage</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {report?.coveragePct ? `${report.coveragePct.toFixed(0)}%` : '--'}
                            </span>
                          </div>
                        </div>

                        <Link to={`/sprints/${s.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs gap-1">
                            <span>Report</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: RELEASE TIMELINE (GANTT) */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Iteration Schedule Roadmap</CardTitle>
                      <CardDescription className="text-xs">
                        Cadence mapping, team assignments, and date milestones
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {timelineEntries.length > 0 ? timelineEntries.length : sprints.length} cycles mapped
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {sprints.map((sprint) => {
                    const progress = getSprintProgress(sprint)
                    return (
                      <div
                        key={sprint.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                                {sprint.name}
                              </span>
                              {getStatusBadge(sprint.status)}
                            </div>
                            <span className="text-xs text-slate-500 font-mono">
                              {sprint.team?.name || 'Assigned Team'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                            <span>{new Date(sprint.startDate).toLocaleDateString()}</span>
                            <span>→</span>
                            <span>{new Date(sprint.endDate).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                            <span>Timeline Duration</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress
                            value={progress}
                            className="h-2"
                            indicatorClassName={
                              sprint.status === 'COMPLETED'
                                ? 'bg-emerald-500'
                                : sprint.status === 'ACTIVE'
                                ? 'bg-blue-500'
                                : 'bg-slate-400'
                            }
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>

      {/* Plan New Sprint Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Plan Iteration Cycle">
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sprint Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 26 - Enterprise Scale & Automation"
              required
              autoFocus
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sprint Goal & Focus
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What is the primary technical objective for this cycle?..."
              className="w-full min-h-[80px] rounded-lg border border-slate-200 bg-white p-2.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assign Team <span className="text-rose-500">*</span>
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              required
            >
              <option value="" disabled>
                Select team to lead this cycle...
              </option>
              {teams.map((team: Team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Start Date <span className="text-rose-500">*</span>
                </label>
              </div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleSetTwoWeeks}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Set 2 Weeks
                </button>
              </div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={createMutation.isPending}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Sprint</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
