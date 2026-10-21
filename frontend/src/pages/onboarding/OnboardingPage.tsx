import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GraduationCap,
  UserCheck,
  Award,
  UserPlus,
  AlertCircle,
  ArrowRight,
  Search,
  TrendingUp,
  AlertTriangle,
  FileText,
  Check,
  ShieldCheck,
  Activity,
  Flame,
  GitCommit,
  GitPullRequest,
  CheckSquare,
  Users,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { onboardingService, membersService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { useOrganizationStore } from '@/stores/organizationStore'
import { QueryState } from '../pageUtils'
import {
  AssignMentorModal,
  DeveloperJourneyDrawer,
  TemplateBuilderModal,
  ExtendDurationModal,
} from './components'
import type { Onboarding, OnboardingTemplate, AtRiskDeveloper } from '@/types'

const MILESTONE_CONFIG = [
  { type: 'FIRST_COMMIT', label: 'First Commit', icon: <GitCommit className="h-3 w-3" /> },
  { type: 'FIRST_BUGFIX', label: 'Bug Fix', icon: <Flame className="h-3 w-3" /> },
  { type: 'FIRST_FEATURE', label: 'Feature', icon: <CheckSquare className="h-3 w-3" /> },
  { type: 'FIRST_REVIEW', label: 'Review', icon: <ShieldCheck className="h-3 w-3" /> },
  { type: 'FIRST_PR_MERGED', label: 'PR Merged', icon: <GitPullRequest className="h-3 w-3" /> },
  { type: 'FIRST_TEST', label: 'Test Suite', icon: <Award className="h-3 w-3" /> },
]

export function OnboardingPage() {
  const queryClient = useQueryClient()
  const { currentOrganization } = useOrganizationStore()

  // State
  const [activeTab, setActiveTab] = useState<'roster' | 'at-risk' | 'velocity' | 'templates'>('roster')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'AT_RISK' | 'COMPLETED'>('ALL')
  const [mentorFilter, setMentorFilter] = useState('ALL')

  // Modals & Drawers
  const [selectedTrack, setSelectedTrack] = useState<Onboarding | null>(null)
  const [isJourneyDrawerOpen, setIsJourneyDrawerOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false)
  const [isExtendOpen, setIsExtendOpen] = useState(false)
  const [trackToExtend, setTrackToExtend] = useState<Onboarding | null>(null)
  const [trackToAssignMentor, setTrackToAssignMentor] = useState<string | null>(null)

  // Form State for Enrollment
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedMentorId, setSelectedMentorId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  // Queries
  const onboardingQuery = useQuery({
    queryKey: queryKeys.onboarding.all(),
    queryFn: () => onboardingService.getAll(),
  })

  const mentorsQuery = useQuery({
    queryKey: queryKeys.onboarding.availableMentors,
    queryFn: () => onboardingService.getAvailableMentors(),
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.organizations.members(currentOrganization?.id || ''),
    queryFn: () => membersService.getAll(),
    enabled: !!currentOrganization?.id,
  })

  const templatesQuery = useQuery({
    queryKey: ['onboarding-templates', currentOrganization?.id],
    queryFn: () => onboardingService.getTemplates(),
  })

  const atRiskQuery = useQuery({
    queryKey: ['onboarding-at-risk', currentOrganization?.id],
    queryFn: () => onboardingService.getAtRiskDevelopers(),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { userId: string; mentorId?: string; templateId?: string }) =>
      onboardingService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.availableMentors })
      queryClient.invalidateQueries({ queryKey: ['onboarding-at-risk'] })
      setIsCreateOpen(false)
      setSelectedUserId('')
      setSelectedMentorId('')
      setSelectedTemplateId('')
      setCreateError(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to start onboarding'
      setCreateError(Array.isArray(msg) ? msg.join(', ') : msg)
    },
  })

  const assignMentorMutation = useMutation({
    mutationFn: ({ trackId, mentorId }: { trackId: string; mentorId: string }) =>
      onboardingService.assignMentor(trackId, mentorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.availableMentors })
      setTrackToAssignMentor(null)
      if (selectedTrack) {
        setSelectedTrack((prev) => (prev ? { ...prev, mentorId: 'updated' } : null))
      }
    },
  })

  const updateChecklistMutation = useMutation({
    mutationFn: ({ trackId, itemId, completed }: { trackId: string; itemId: string; completed: boolean }) =>
      onboardingService.updateChecklistItem(trackId, itemId, { isCompleted: completed }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() })
      if (selectedTrack && selectedTrack.id === variables.trackId) {
        setSelectedTrack((prev) => {
          if (!prev) return null
          const nextItems = prev.checklistItems.map((item) =>
            item.id === variables.itemId ? { ...item, isCompleted: variables.completed } : item
          )
          const done = nextItems.filter((i) => i.isCompleted).length
          const nextProgress = Math.round((done / Math.max(1, nextItems.length)) * 100)
          return { ...prev, checklistItems: nextItems, progress: nextProgress }
        })
      }
    },
  })

  const completeMutation = useMutation({
    mutationFn: (trackId: string) => onboardingService.complete(trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() })
      queryClient.invalidateQueries({ queryKey: ['onboarding-at-risk'] })
      setIsJourneyDrawerOpen(false)
    },
  })

  const extendMutation = useMutation({
    mutationFn: ({ trackId, newEndDate, reason }: { trackId: string; newEndDate: string; reason?: string }) =>
      onboardingService.extend(trackId, { newEndDate, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() })
      setIsExtendOpen(false)
      setTrackToExtend(null)
    },
  })

  const createTemplateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; items: Array<{ title: string; description?: string; order: number }> }) =>
      onboardingService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-templates'] })
      setIsTemplateBuilderOpen(false)
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => onboardingService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-templates'] })
    },
  })

  // Derived Data
  const tracks: Onboarding[] = onboardingQuery.data ?? []
  const mentors = mentorsQuery.data ?? []
  const members = membersQuery.data ?? []
  const templates: OnboardingTemplate[] = templatesQuery.data ?? []
  const atRiskList: AtRiskDeveloper[] = atRiskQuery.data ?? []

  const activeTracks = tracks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACTIVE')
  const completedTracks = tracks.filter((t) => t.status === 'COMPLETED')
  const atRiskTracks = tracks.filter((t) => t.status === 'AT_RISK' || t.isAtRisk)

  // Enrollment Eligibility
  const activeUserIds = new Set(
    tracks
      .filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACTIVE')
      .map((t) => t.userId || t.developerId)
  )
  const eligibleMembers = members.filter((m) => !activeUserIds.has(m.userId))

  // Metrics Calculations
  const avgProgress = activeTracks.length > 0
    ? Math.round(activeTracks.reduce((acc, t) => acc + (t.progress || 0), 0) / activeTracks.length)
    : 0

  const pairedMentorsCount = activeTracks.filter((t) => !!t.mentorId).length
  const mentorshipCoverage = activeTracks.length > 0
    ? Math.round((pairedMentorsCount / activeTracks.length) * 100)
    : 100

  // Filtered Roster
  const filteredTracks = useMemo(() => {
    return tracks.filter((track) => {
      const devName = track.user?.name || track.developer?.name || track.developerId || ''
      const devEmail = track.user?.email || track.developer?.email || ''
      const squad = (track.user as any)?.teamMemberships?.[0]?.team?.name || ''

      const matchesSearch =
        devName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        devEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        squad.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && (track.status === 'IN_PROGRESS' || track.status === 'ACTIVE')) ||
        (statusFilter === 'AT_RISK' && (track.status === 'AT_RISK' || track.isAtRisk)) ||
        (statusFilter === 'COMPLETED' && track.status === 'COMPLETED')

      const matchesMentor =
        mentorFilter === 'ALL' ||
        (mentorFilter === 'UNASSIGNED' && !track.mentorId) ||
        track.mentorId === mentorFilter

      return matchesSearch && matchesStatus && matchesMentor
    })
  }, [tracks, searchQuery, statusFilter, mentorFilter])

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Sleek Top Header Toolbar (Zero Hero Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Developer Onboarding & Ramp-Up Studio
                </h1>
                <Badge variant="outline" className="font-mono text-[11px] text-indigo-600 border-indigo-500/30">
                  Time-to-First-PR Engine
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accelerated engineer ramp-up, interactive checklist verification, and milestone telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTemplateBuilderOpen(true)}
            className="text-xs gap-1.5 border-slate-200 dark:border-slate-800"
          >
            <FileText className="h-3.5 w-3.5" />
            New Template
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Start Onboarding
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onboardingQuery.refetch()
              mentorsQuery.refetch()
              templatesQuery.refetch()
              atRiskQuery.refetch()
            }}
            className="h-8 w-8 p-0"
            title="Refresh Data"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* 4-Card Executive KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Active Tracks */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Cohort</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {activeTracks.length}
                </span>
                <span className="text-xs text-slate-500">developers</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {completedTracks.length} graduated • 90d window
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Average Ramp-up Velocity */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ramp-Up Velocity</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {avgProgress}%
                </span>
                <span className="text-xs text-emerald-500 font-medium">avg completion</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Checklists & milestone funnel blended
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: At-Risk Developers */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">At-Risk Radar</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {atRiskTracks.length + atRiskList.length}
                </span>
                {atRiskTracks.length + atRiskList.length > 0 ? (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                    Needs Attention
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono text-emerald-600 border-emerald-500/30">
                    Nominal
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                &gt;7d to first commit or &gt;14d to review
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Mentorship Pairing Coverage */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mentor Pairing</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {mentorshipCoverage}%
                </span>
                <span className="text-xs text-slate-500">coverage</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {mentors.length} active mentors • 3 max capacity
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <TabsTrigger value="roster" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Active Roster ({tracks.length})
          </TabsTrigger>
          <TabsTrigger value="at-risk" className="text-xs gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            At-Risk Radar ({atRiskTracks.length + atRiskList.length})
          </TabsTrigger>
          <TabsTrigger value="velocity" className="text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Milestones &amp; Benchmarks
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Checklist Templates ({templates.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* TAB 1: ACTIVE ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by developer, email, or squad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-md text-xs">
                {(['ALL', 'ACTIVE', 'AT_RISK', 'COMPLETED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      statusFilter === st
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : st === 'AT_RISK' ? 'At-Risk' : 'Completed'}
                  </button>
                ))}
              </div>

              {/* Mentor Filter */}
              <select
                value={mentorFilter}
                onChange={(e) => setMentorFilter(e.target.value)}
                className="py-1 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All Mentors</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    Mentor: {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <QueryState isLoading={onboardingQuery.isLoading} error={onboardingQuery.error} onRetry={() => onboardingQuery.refetch()}>
            <div className="grid gap-4">
              {filteredTracks.map((track) => {
                const devName = track.user?.name || track.developer?.name || track.developerId || 'New Developer'
                const devEmail = track.user?.email || track.developer?.email
                const squad =
                  (track.user as any)?.teamMemberships?.[0]?.team?.name ||
                  (track.developer as any)?.teamMemberships?.[0]?.team?.name ||
                  'Engineering'
                const progress = track.progress ?? 0
                const checklistItems = track.checklistItems || []
                const completedItems = checklistItems.filter((i) => i.isCompleted || (i as any).completedAt).length
                const milestones = track.milestones || []

                return (
                  <Card key={track.id} className="border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        {/* Developer & Squad Info */}
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-sm text-indigo-700 dark:text-indigo-300 shrink-0">
                              {devName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                  {devName}
                                </h3>
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-slate-500">
                                  {squad}
                                </Badge>
                                <Badge
                                  variant={
                                    track.status === 'COMPLETED'
                                      ? 'success'
                                      : track.status === 'AT_RISK'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                  className="text-[10px] capitalize"
                                >
                                  {track.status === 'ACTIVE' || track.status === 'IN_PROGRESS' ? 'Active' : track.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-400 truncate">{devEmail}</p>
                            </div>
                          </div>

                          {/* Progress Meter */}
                          <div className="space-y-1 max-w-lg pt-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 font-medium">
                                Tasks: {completedItems} / {checklistItems.length} verified
                              </span>
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {progress}%
                              </span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                          </div>

                          {/* Milestone Funnel Chips */}
                          <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                              Milestones:
                            </span>
                            {MILESTONE_CONFIG.map((m) => {
                              const isAchieved = milestones.some((item) => item.type === m.type)
                              return (
                                <span
                                  key={m.type}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                    isAchieved
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-800/50'
                                  }`}
                                  title={m.label}
                                >
                                  {isAchieved ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : m.icon}
                                  {m.label}
                                </span>
                              )
                            })}
                          </div>
                        </div>

                        {/* Cohort & Mentorship Side Info */}
                        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
                          {/* Mentor Chip */}
                          <div className="flex items-center gap-2">
                            <div className="text-left sm:text-right">
                              <p className="text-[10px] uppercase font-bold text-slate-400">Mentor</p>
                              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {track.mentor?.name || 'Unassigned'}
                              </p>
                            </div>
                            {!track.mentorId && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTrackToAssignMentor(track.id)}
                                className="h-7 text-xs px-2 gap-1"
                              >
                                <UserPlus className="h-3 w-3" /> Pair
                              </Button>
                            )}
                          </div>

                          {/* Cohort Timeline */}
                          <div className="text-left sm:text-right text-xs text-slate-500">
                            <p className="font-medium text-slate-700 dark:text-slate-300">
                              Day {track.daysElapsed || 1} of {track.totalDays || 90}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Ends {track.endDate ? new Date(track.endDate).toLocaleDateString() : 'In 90 Days'}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTrack(track)
                                setIsJourneyDrawerOpen(true)
                              }}
                              className="text-xs gap-1.5 h-8 border-slate-200 dark:border-slate-800"
                            >
                              Inspect Journey
                              <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {filteredTracks.length === 0 && (
                <EmptyState
                  title="No Onboarding Tracks Found"
                  description="No developer matches the selected filters. Enroll a new hire or reset filter criteria."
                  icon={<UserCheck className="h-8 w-8 text-indigo-500" />}
                  action={
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2 text-xs">
                      <UserPlus className="h-3.5 w-3.5" /> Start Onboarding
                    </Button>
                  }
                />
              )}
            </div>
          </QueryState>
        </div>
      )}

      {/* TAB 2: AT-RISK RADAR */}
      {activeTab === 'at-risk' && (
        <div className="space-y-4">
          <Card className="border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <CardTitle className="text-sm font-bold">Early-Intervention Ramp-Up Detection</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Developers who have not pushed their first commit within 7 days, or have not participated in code review within 14 days are flagged automatically to prevent protracted ramp-up delays.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4">
            {atRiskList.map((dev) => (
              <Card key={dev.userId} className="border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{dev.userName}</h4>
                      <Badge variant="destructive" className="text-[10px]">
                        At-Risk • {dev.daysElapsed}d Elapsed
                      </Badge>
                    </div>
                    <div className="space-y-1 pt-1">
                      {dev.riskFactors.map((factor, idx) => (
                        <p key={idx} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {factor}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const targetTrack = tracks.find((t) => (t.userId || t.developerId) === dev.userId)
                        if (targetTrack) {
                          setSelectedTrack(targetTrack)
                          setIsJourneyDrawerOpen(true)
                        }
                      }}
                      className="text-xs"
                    >
                      View Journey
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const targetTrack = tracks.find((t) => (t.userId || t.developerId) === dev.userId)
                        if (targetTrack) {
                          setTrackToAssignMentor(targetTrack.id)
                        }
                      }}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Pair Senior Mentor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {atRiskList.length === 0 && (
              <EmptyState
                title="Zero At-Risk Developers"
                description="All in-flight developers are progressing along expected milestone velocity timelines without recorded blockers."
                icon={<ShieldCheck className="h-8 w-8 text-emerald-500" />}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MILESTONES & BENCHMARKS */}
      {activeTab === 'velocity' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Target Time-to-First-Commit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">&lt; 3.0</span>
                  <span className="text-xs text-slate-500">Days</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Verifies local Docker tooling and repository checkout readiness.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Target Time-to-First-Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">&lt; 7.0</span>
                  <span className="text-xs text-slate-500">Days</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Measures comprehension of architecture and PR code review guidelines.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Target Time-to-First-PR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">&lt; 14.0</span>
                  <span className="text-xs text-slate-500">Days</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Core industry developer experience benchmark for productive code merge.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 6 Core Milestones Explanatory Matrix */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Standard 6-Stage Engineering Ramp-Up Pipeline</CardTitle>
              <CardDescription className="text-xs">
                Every developer cohort advances through automated, objective verification gates to complete onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MILESTONE_CONFIG.map((m, idx) => (
                  <div
                    key={m.type}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span className="h-5 w-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        {m.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Milestone {idx + 1}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {m.type === 'FIRST_COMMIT' && 'Verifies initial repository commit, branch creation, and local environment.'}
                      {m.type === 'FIRST_BUGFIX' && 'Resolves an initial defect, confirming understanding of regression testing.'}
                      {m.type === 'FIRST_FEATURE' && 'Implements an end-to-end task according to sprint acceptance criteria.'}
                      {m.type === 'FIRST_REVIEW' && 'Reviews peer pull request, applying code standards and review conventions.'}
                      {m.type === 'FIRST_PR_MERGED' && 'Merged pull request through automated CI quality gates to production/main.'}
                      {m.type === 'FIRST_TEST' && 'Adds unit or integration test coverage to preserve test suite integrity.'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: CHECKLIST TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Reusable Checklist Templates</h3>
              <p className="text-xs text-slate-500">
                Standardize ramp-up workflows by team role (Frontend, Backend, SRE, Mobile).
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsTemplateBuilderOpen(true)}
              className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Template
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Standard Built-in Template */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold">Standard Engineering Core Track</CardTitle>
                  <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-500/30">
                    System Default
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Default 4-step pathway applied automatically to newly enrolled developers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                  1. Set up local Docker environment
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                  2. Run test suite locally
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                  3. Review architecture documentation
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                  4. Submit and merge first pull request
                </div>
              </CardContent>
            </Card>

            {/* Custom Created Templates */}
            {templates.map((tpl) => {
              const items = Array.isArray(tpl.items) ? tpl.items : []
              return (
                <Card key={tpl.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold">{tpl.name}</CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTemplateMutation.mutate(tpl.id)}
                        className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        Delete
                      </Button>
                    </div>
                    {tpl.description && (
                      <CardDescription className="text-xs">{tpl.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {items.slice(0, 4).map((it: any, i: number) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 truncate"
                      >
                        {i + 1}. {it.title}
                      </div>
                    ))}
                    {items.length > 4 && (
                      <p className="text-[11px] text-slate-400 text-center">+{items.length - 4} more steps</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Slide-Over Developer Journey Drawer */}
      <DeveloperJourneyDrawer
        track={selectedTrack}
        open={isJourneyDrawerOpen}
        onClose={() => {
          setIsJourneyDrawerOpen(false)
          setSelectedTrack(null)
        }}
        onToggleChecklist={(trackId, itemId, completed) => {
          updateChecklistMutation.mutate({ trackId, itemId, completed })
        }}
        onReassignMentor={(trackId) => setTrackToAssignMentor(trackId)}
        onComplete={(trackId) => completeMutation.mutate(trackId)}
        onOpenExtend={(trackId) => {
          const t = tracks.find((tr) => tr.id === trackId)
          if (t) {
            setTrackToExtend(t)
            setIsExtendOpen(true)
          }
        }}
        isToggling={updateChecklistMutation.isPending}
        isCompleting={completeMutation.isPending}
      />

      {/* Start Onboarding Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          setCreateError(null)
        }}
        title="Enroll Developer in Onboarding"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedUserId) {
              setCreateError('Please select a developer.')
              return
            }
            createMutation.mutate({
              userId: selectedUserId,
              mentorId: selectedMentorId || undefined,
              templateId: selectedTemplateId || undefined,
            })
          }}
          className="space-y-4"
        >
          {createError && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 text-xs flex items-center gap-2 dark:bg-red-950 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Select Developer <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value)
                setCreateError(null)
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              required
            >
              <option value="">Choose an eligible team member...</option>
              {(eligibleMembers.length > 0 ? eligibleMembers : members).map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name || m.user?.email || m.userId} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Assign Senior Mentor (Optional)
            </label>
            <select
              value={selectedMentorId}
              onChange={(e) => setSelectedMentorId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Pair with a senior mentor (or assign later)...</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.currentMentees || 0} active mentees)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Checklist Template (Optional)
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">System Default (Standard 4-Step Track)</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                setCreateError(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Start Onboarding
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Mentor Modal */}
      <AssignMentorModal
        open={!!trackToAssignMentor}
        onClose={() => setTrackToAssignMentor(null)}
        mentors={mentors}
        onAssign={(mentorId) => {
          if (trackToAssignMentor) {
            assignMentorMutation.mutate({ trackId: trackToAssignMentor, mentorId })
          }
        }}
        isPending={assignMentorMutation.isPending}
      />

      {/* Extend Duration Modal */}
      <ExtendDurationModal
        open={isExtendOpen}
        onClose={() => {
          setIsExtendOpen(false)
          setTrackToExtend(null)
        }}
        currentEndDate={trackToExtend?.endDate}
        onExtend={(newEndDate, reason) => {
          if (trackToExtend) {
            extendMutation.mutate({ trackId: trackToExtend.id, newEndDate, reason })
          }
        }}
        isPending={extendMutation.isPending}
      />

      {/* Template Builder Modal */}
      <TemplateBuilderModal
        open={isTemplateBuilderOpen}
        onClose={() => setIsTemplateBuilderOpen(false)}
        onCreate={(data) => createTemplateMutation.mutate(data)}
        isPending={createTemplateMutation.isPending}
      />
    </div>
  )
}
