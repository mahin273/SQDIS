import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Award,
  Users,
  GitCommit,
  Search,
  Plus,
  AlertTriangle,
  Sparkles,
  Layers,
  RefreshCw,
  Settings,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FolderGit2,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScoreGauge } from '@/components/charts'
import { teamsService, membersService, projectsService, codeIntelligenceService, scoresService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatDate, formatNumber } from '@/lib/utils'
import { QueryState, formatScore } from '../pageUtils'
import type { TeamMetrics, TeamCommit, TeamMemberProfile, TeamProjectSummary } from '@/types'
import type { TeamBusFactorResponse, ModuleBusFactorResult } from '@/services'

function getDqsTier(score?: number | null) {
  if (score === null || score === undefined || isNaN(score)) {
    return { label: 'Unrated', color: 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400' }
  }
  if (score >= 80) {
    return { label: 'Elite', color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' }
  }
  if (score >= 70) {
    return { label: 'Proficient', color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' }
  }
  if (score >= 60) {
    return { label: 'Moderate', color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' }
  }
  return { label: 'Developing', color: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' }
}

function getCommitBadge(classification?: string | null) {
  const norm = classification?.toUpperCase() || 'UNKNOWN'
  switch (norm) {
    case 'FEATURE':
      return { label: 'Feature', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' }
    case 'BUGFIX':
    case 'FIX':
      return { label: 'Bug Fix', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' }
    case 'REFACTOR':
      return { label: 'Refactor', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300' }
    case 'TEST':
      return { label: 'Test', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' }
    case 'DOCS':
      return { label: 'Docs', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300' }
    default:
      return { label: 'Commit', color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300' }
  }
}

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState('roster')
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [assigningProjectId, setAssigningProjectId] = useState<string | null>(null)
  const [unassigningProjectId, setUnassigningProjectId] = useState<string | null>(null)
  const [projectActionError, setProjectActionError] = useState<string | null>(null)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const teamQuery = useQuery({
    queryKey: queryKeys.teams.detail(id ?? ''),
    queryFn: () => teamsService.getById(id!),
    enabled: !!id,
  })
  
  const metricsQuery = useQuery({
    queryKey: queryKeys.teams.metrics(id ?? ''),
    queryFn: () => teamsService.getMetrics(id!),
    enabled: !!id,
  })

  const commitsQuery = useQuery({
    queryKey: ['team-commits', id],
    queryFn: () => teamsService.getCommits(id!, 25),
    enabled: !!id,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.members.all(),
    queryFn: () => membersService.getAll(),
  })

  const busFactorQuery = useQuery({
    queryKey: ['team-bus-factor', id],
    queryFn: () => codeIntelligenceService.getTeamBusFactor(id!),
    enabled: !!id,
  })

  const busFactorData = busFactorQuery.data as TeamBusFactorResponse | undefined
  const busFactorRiskTier = (busFactorData?.critical_silos_count ?? 0) > 0
    ? 'CRITICAL'
    : (busFactorData?.vulnerable_count ?? 0) > 0
    ? 'HIGH'
    : 'LOW'

  const siloedModules: ModuleBusFactorResult[] = (busFactorData?.module_results ?? []).filter(
    (m: ModuleBusFactorResult) => m.risk_level === 'CRITICAL_SILO' || m.risk_level === 'VULNERABLE'
  )
  const busFactorRecommendations: string[] = (busFactorData?.module_results ?? [])
    .map((m: ModuleBusFactorResult) => m.cross_training_recommendation)
    .filter((r): r is string => Boolean(r))

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => teamsService.addMember(id!, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.metrics(id!) })
      queryClient.invalidateQueries({ queryKey: ['team-commits', id] })
      setIsAddMemberOpen(false)
      setSelectedUserId('')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => teamsService.removeMember(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.metrics(id!) })
      queryClient.invalidateQueries({ queryKey: ['team-commits', id] })
    },
  })

  const assignLeadMutation = useMutation({
    mutationFn: (userId: string) => teamsService.assignLead(id!, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(id!) })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => teamsService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(id!) })
      setIsEditOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => teamsService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
      navigate('/teams')
    },
  })

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const team = teamQuery.data
      if (team?.members && team.members.length > 0) {
        for (const member of team.members) {
          try {
            await scoresService.recalculate({ entityId: member.id, type: 'DQS' })
          } catch {
            // continue best-effort
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.metrics(id!) })
      queryClient.invalidateQueries({ queryKey: ['team-commits', id] })
      queryClient.invalidateQueries({ queryKey: ['team-bus-factor', id] })
    },
  })

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => projectsService.getAll(),
  })

  const assignProjectMutation = useMutation({
    mutationFn: (projectId: string) => {
      setProjectActionError(null)
      return projectsService.assignTeam(projectId, { teamId: id! })
    },
    onMutate: (projectId: string) => {
      setAssigningProjectId(projectId)
    },
    onSettled: () => {
      setAssigningProjectId(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      queryClient.invalidateQueries({ queryKey: ['team-bus-factor', id] })
    },
    onError: (err: any) => {
      setProjectActionError(
        err?.response?.data?.message || err?.message || 'Failed to assign project'
      )
    },
  })

  const removeProjectMutation = useMutation({
    mutationFn: (projectId: string) => {
      setProjectActionError(null)
      return projectsService.removeTeam(projectId, id!)
    },
    onMutate: (projectId: string) => {
      setUnassigningProjectId(projectId)
    },
    onSettled: () => {
      setUnassigningProjectId(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      queryClient.invalidateQueries({ queryKey: ['team-bus-factor', id] })
    },
    onError: (err: any) => {
      setProjectActionError(
        err?.response?.data?.message || err?.message || 'Failed to unassign project'
      )
    },
  })

  const team = teamQuery.data
  const metrics = metricsQuery.data as TeamMetrics | undefined
  const teamCommits = (commitsQuery.data ?? []) as TeamCommit[]
  
  const effectiveDqs = team?.avgDqs ?? team?.score ?? metrics?.aggregatedDQS ?? null
  const dqsTier = getDqsTier(effectiveDqs)

  const availableMembers = (membersQuery.data ?? []).filter(
    (m) => !(team?.members ?? []).some((tm) => tm.id === m.userId || tm.id === m.id)
  )

  const filteredMembers = useMemo(() => {
    return (team?.members ?? []).filter(member => {
      if (!memberSearchQuery) return true
      const q = memberSearchQuery.toLowerCase()
      return member.name?.toLowerCase().includes(q) || member.email?.toLowerCase().includes(q)
    })
  }, [team?.members, memberSearchQuery])

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return
    addMemberMutation.mutate(selectedUserId)
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    updateMutation.mutate({ name, description })
  }

  const openEditModal = () => {
    if (team) {
      setName(team.name)
      setDescription(team.description || '')
      setIsEditOpen(true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <Link to="/teams" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Teams Directory
        </Link>
      </div>

      <QueryState isLoading={teamQuery.isLoading} error={teamQuery.error} onRetry={() => teamQuery.refetch()}>
        {team && (
          <div className="space-y-6">
            {/* Identity Hero Banner with circular ScoreGauge */}
            <Card className="overflow-hidden border-slate-200/90 shadow-xs dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold text-lg shadow-sm">
                        {team.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {team.name}
                          </h1>
                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                            Engineering Squad
                          </Badge>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Squad
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {team.description || 'Enterprise engineering squad delivering platform and product capabilities.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600 dark:text-slate-300">
                      {team.lead ? (
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-900">
                          <Avatar name={team.lead.name || team.lead.email} src={team.lead.avatarUrl} size="sm" />
                          <span className="font-medium text-slate-900 dark:text-slate-100">{team.lead.name || team.lead.email}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-blue-300 text-blue-700 dark:text-blue-300">
                            Squad Lead
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                          <Shield className="h-3.5 w-3.5" />
                          <span>Squad Lead Unassigned</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-900">
                        <Users className="h-3.5 w-3.5 text-blue-500" />
                        <span>{team.members?.length ?? team.memberCount ?? 0} Contributors</span>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-900">
                        <Layers className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{team.projects?.length ?? team.projectCount ?? 0} Projects Assigned</span>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-900">
                        <GitCommit className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{team.commits ?? metrics?.totalCommits ?? 0} Commits</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recalculateMutation.mutate()}
                        isLoading={recalculateMutation.isPending}
                        className="gap-1.5 text-xs h-8"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-indigo-500" /> Recalculate DQS
                      </Button>
                      <Button size="sm" onClick={() => setIsAddMemberOpen(true)} className="gap-1.5 text-xs h-8">
                        <UserPlus className="h-3.5 w-3.5" /> Add Member
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsProjectModalOpen(true)} className="gap-1.5 text-xs h-8">
                        <Plus className="h-3.5 w-3.5 text-blue-500" /> Assign Project
                      </Button>
                      <Button size="sm" variant="outline" onClick={openEditModal} className="gap-1.5 text-xs h-8">
                        <Settings className="h-3.5 w-3.5" /> Edit Squad
                      </Button>
                    </div>
                  </div>

                  {/* Circular ScoreGauge */}
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 shrink-0 min-w-[200px]">
                    <ScoreGauge
                      value={effectiveDqs ?? 0}
                      label="Team DQS"
                      size="sm"
                    />
                    <div className="mt-1 text-center">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${dqsTier.color}`}>
                        {dqsTier.label} Tier
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Evaluated across {team.members?.length ?? 0} members
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4-Card Executive KPI Strip */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-slate-200/90 shadow-2xs dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Team DQS Index
                  </CardTitle>
                  <Award className="h-4 w-4 text-indigo-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {formatScore(effectiveDqs)}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${dqsTier.color}`}>
                      {dqsTier.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Aggregated contributor quality index
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200/90 shadow-2xs dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Squad Contributors
                  </CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {team.members?.length ?? team.memberCount ?? 0}
                    </div>
                    <span className="text-xs text-slate-500">Active</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {team.lead ? `Squad Lead: ${team.lead.name || team.lead.email}` : 'Squad lead unassigned'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200/90 shadow-2xs dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Knowledge Resilience
                  </CardTitle>
                  {busFactorRiskTier === 'CRITICAL' ? (
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {(busFactorData?.overall_bus_factor ?? 1).toFixed(1)}
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor:
                          busFactorRiskTier === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' :
                          busFactorRiskTier === 'HIGH' ? 'rgba(249, 115, 22, 0.1)' :
                          'rgba(16, 185, 129, 0.1)',
                        color:
                          busFactorRiskTier === 'CRITICAL' ? '#ef4444' :
                          busFactorRiskTier === 'HIGH' ? '#f97316' :
                          '#10b981',
                        borderColor:
                          busFactorRiskTier === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' :
                          busFactorRiskTier === 'HIGH' ? 'rgba(249, 115, 22, 0.25)' :
                          'rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      {busFactorRiskTier} RISK
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Gini: {(busFactorData?.average_gini ?? 0).toFixed(2)} &bull; {busFactorData?.critical_silos_count ?? 0} Silos
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200/90 shadow-2xs dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Squad Velocity
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {formatNumber(team.commits ?? metrics?.totalCommits ?? 0)}
                    </div>
                    <span className="text-xs text-slate-500">Commits</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {metrics?.totalCommits ? `${metrics.totalCommits} rolling (30d)` : 'All-time team output'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 4-Tab Operational Layout */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800">
                <TabsList className="bg-transparent p-0 gap-6">
                  <TabsTrigger
                    value="roster"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent px-1 pb-3 text-sm font-semibold transition-none shadow-none flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" /> Roster & Contributor Health
                    <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0">
                      {team.members?.length ?? 0}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="bus-factor"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent px-1 pb-3 text-sm font-semibold transition-none shadow-none flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" /> Knowledge Silos & Bus Factor
                    {siloedModules.length > 0 && (
                      <span className="ml-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] font-bold px-1.5 py-0.5">
                        {siloedModules.length} Silos
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="projects"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent px-1 pb-3 text-sm font-semibold transition-none shadow-none flex items-center gap-2"
                  >
                    <Layers className="h-4 w-4" /> Associated Projects
                    <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0">
                      {team.projects?.length ?? 0}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent px-1 pb-3 text-sm font-semibold transition-none shadow-none flex items-center gap-2"
                  >
                    <GitCommit className="h-4 w-4" /> Squad Commit Cadence
                    {teamCommits.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0">
                        {teamCommits.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab 1: Member Roster & Performance */}
              <TabsContent value="roster" className="space-y-4">
                <Card className="border-slate-200/90 shadow-2xs dark:border-slate-800">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <CardTitle className="text-base">Squad Contributor Roster</CardTitle>
                      <CardDescription className="text-xs">
                        Review individual contributor DQS scores, commit footprints, and leadership roles.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 mt-3 sm:mt-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search members..."
                          className="pl-9 w-full sm:w-60 h-9 text-xs"
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                        />
                      </div>
                      <Button size="sm" onClick={() => setIsAddMemberOpen(true)} className="gap-1.5 h-9 text-xs">
                        <UserPlus className="h-3.5 w-3.5" /> Add Member
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredMembers.length === 0 ? (
                      <EmptyState
                        icon={<Users className="h-8 w-8 text-slate-400" />}
                        title="No members found"
                        description={memberSearchQuery ? "No squad members matched your search query." : "There are no members assigned to this squad yet."}
                        action={!memberSearchQuery && (
                          <Button onClick={() => setIsAddMemberOpen(true)} size="sm">
                            <Plus className="mr-1.5 h-4 w-4" /> Add First Member
                          </Button>
                        )}
                      />
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredMembers.map((member: TeamMemberProfile) => {
                          const isLead = team.lead?.id === member.id
                          const mTier = getDqsTier(member.dqsScore)
                          const squadTotalCommits = team.commits || 1
                          const memberCommits = member.commits ?? 0
                          const share = Math.round((memberCommits / squadTotalCommits) * 100)

                          return (
                            <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar name={member.name || member.email} src={member.avatarUrl} size="md" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Link
                                      to={`/developers/${member.id}`}
                                      className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 group truncate"
                                    >
                                      <span>{member.name || member.email}</span>
                                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                                    </Link>
                                    {isLead && (
                                      <Badge variant="outline" className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 text-[10px] py-0">
                                        <ShieldCheck className="h-3 w-3" /> Squad Lead
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-6 sm:justify-end">
                                <div className="text-right shrink-0">
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                      {formatScore(member.dqsScore)}
                                    </span>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full border ${mTier.color}`}>
                                      {mTier.label}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400">Contributor DQS</span>
                                </div>

                                <div className="text-right shrink-0 hidden md:block min-w-[110px]">
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                    {memberCommits} commits ({share}%)
                                  </span>
                                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(5, share))}%` }} />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {!isLead && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={() => assignLeadMutation.mutate(member.id)}
                                      isLoading={assignLeadMutation.isPending}
                                    >
                                      Make Lead
                                    </Button>
                                  )}
                                  <Link to={`/developers/${member.id}`}>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
                                      Profile <ChevronRight className="h-3 w-3 ml-0.5" />
                                    </Button>
                                  </Link>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                                    onClick={() => removeMemberMutation.mutate(member.id)}
                                    isLoading={removeMemberMutation.isPending}
                                    title="Remove from squad"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Knowledge Silos & Bus Factor */}
              <TabsContent value="bus-factor" className="space-y-4">
                <Card className="border-slate-200/90 shadow-2xs dark:border-slate-800">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Shield className="h-5 w-5 text-indigo-500" /> Knowledge Silos & Bus Factor Radar
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Algorithmic analysis of codebase authorship concentration, Gini inequality, and single-maintainer vulnerabilities.
                      </CardDescription>
                    </div>
                    {busFactorData && (busFactorData.total_modules_analyzed ?? 0) > 0 && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mt-2 sm:mt-0"
                        style={{
                          backgroundColor:
                            busFactorRiskTier === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' :
                            busFactorRiskTier === 'HIGH' ? 'rgba(249, 115, 22, 0.1)' :
                            'rgba(16, 185, 129, 0.1)',
                          color:
                            busFactorRiskTier === 'CRITICAL' ? '#ef4444' :
                            busFactorRiskTier === 'HIGH' ? '#f97316' :
                            '#10b981',
                          borderColor:
                            busFactorRiskTier === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' :
                            busFactorRiskTier === 'HIGH' ? 'rgba(249, 115, 22, 0.25)' :
                            'rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        {busFactorRiskTier === 'CRITICAL' || busFactorRiskTier === 'HIGH' ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        {busFactorRiskTier} RISK RESILIENCE
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-5 pt-4">
                    {busFactorQuery.isLoading ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        Calculating squad bus factor and authorship distribution...
                      </div>
                    ) : !busFactorData || busFactorData.has_assigned_projects === false || (team.projects?.length ?? 0) === 0 ? (
                      <EmptyState
                        icon={<Layers className="h-8 w-8 text-indigo-500" />}
                        title="No Projects Assigned"
                        description="Assign a project to this team to evaluate code ownership, file hotspots, and single-maintainer bus factor risks."
                        action={
                          <Button variant="outline" size="sm" onClick={() => setIsProjectModalOpen(true)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Assign Project
                          </Button>
                        }
                      />
                    ) : (busFactorData.total_modules_analyzed ?? 0) === 0 ? (
                      <EmptyState
                        icon={<GitCommit className="h-8 w-8 text-slate-400" />}
                        title="No Commit Activity Found"
                        description="No commit activity has been recorded for this squad's assigned projects yet."
                      />
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Overall Bus Factor</span>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                              {(busFactorData?.overall_bus_factor ?? 0).toFixed(1)}
                            </p>
                            <span className="text-[11px] text-slate-400">Min engineers needed</span>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Gini Inequality</span>
                            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-500">
                              {(busFactorData?.average_gini ?? 0).toFixed(2)}
                            </p>
                            <span className="text-[11px] text-slate-400">0 = Equal, 1 = Monopoly</span>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Critical Silos</span>
                            <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-500">
                              {busFactorData?.critical_silos_count ?? 0}
                            </p>
                            <span className="text-[11px] text-slate-400">Single-maintainer modules</span>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Modules Analyzed</span>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                              {busFactorData?.total_modules_analyzed ?? 0}
                            </p>
                            <span className="text-[11px] text-slate-400">Directory clusters screened</span>
                          </div>
                        </div>

                        {siloedModules.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              Identified Single-Maintainer Knowledge Silos
                            </h4>
                            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800 overflow-hidden">
                              {siloedModules.map((module: ModuleBusFactorResult, i: number) => (
                                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 text-xs gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                                        {module.module_name}
                                      </span>
                                      <Badge variant="outline" className={`text-[10px] py-0 ${
                                        module.risk_level === 'CRITICAL_SILO'
                                          ? 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300'
                                          : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300'
                                      }`}>
                                        Bus Factor {module.bus_factor} &bull; {module.risk_level.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      Key maintainers: <span className="font-medium text-slate-700 dark:text-slate-300">{module.key_owners?.join(', ') || 'Unassigned'}</span>
                                      {module.total_commits ? ` &bull; ${module.total_commits} commits` : ''}
                                      {module.total_churn ? ` &bull; ${formatNumber(module.total_churn)} churn LOC` : ''}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                                      Gini: {module.gini_coefficient.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {busFactorRecommendations.length > 0 && (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-2">
                            <span className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 text-xs">
                              <Sparkles className="h-4 w-4 text-indigo-500" />
                              AI Cross-Training & Knowledge Decentralization Directives
                            </span>
                            <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                              {busFactorRecommendations.map((rec: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-indigo-500 font-bold">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: Associated Projects & Delivery */}
              <TabsContent value="projects" className="space-y-4">
                <Card className="border-slate-200/90 shadow-2xs dark:border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <CardTitle className="text-base">Assigned Portfolio Projects</CardTitle>
                      <CardDescription className="text-xs">
                        Portfolio initiatives and repositories delivered by this engineering squad.
                      </CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setIsProjectModalOpen(true)} className="gap-1.5 h-8 text-xs">
                      <Plus className="h-3.5 w-3.5 text-blue-500" /> Assign Project
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4">
                    {(!team.projects || team.projects.length === 0) ? (
                      <EmptyState
                        icon={<Layers className="h-8 w-8 text-slate-400" />}
                        title="No Projects Assigned"
                        description="This squad is not currently assigned to any portfolio initiatives."
                        action={
                          <Button size="sm" onClick={() => setIsProjectModalOpen(true)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Assign First Project
                          </Button>
                        }
                      />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {team.projects.map((project: TeamProjectSummary) => (
                          <div
                            key={project.id}
                            className="rounded-xl border border-slate-200 p-4 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-800 transition-all flex flex-col justify-between space-y-4 bg-white dark:bg-slate-900/60 shadow-2xs"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <Link
                                    to={`/projects/${project.id}`}
                                    className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-base transition-colors flex items-center gap-1.5"
                                  >
                                    <FolderGit2 className="h-4 w-4 text-indigo-500" />
                                    <span>{project.name}</span>
                                  </Link>
                                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                                    {project.description || 'Enterprise project repository and delivery portfolio.'}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg dark:bg-slate-800 dark:border-slate-700">
                                    <Award className="h-3.5 w-3.5 text-indigo-500" />
                                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                      {formatScore(project.sqsScore)}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">Project SQS</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                              <Link
                                to={`/projects/${project.id}`}
                                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                              >
                                View Project Workbench <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                                disabled={removeProjectMutation.isPending && unassigningProjectId === project.id}
                                onClick={() => removeProjectMutation.mutate(project.id)}
                              >
                                Unassign
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 4: Squad Commit Cadence */}
              <TabsContent value="activity" className="space-y-4">
                <Card className="border-slate-200/90 shadow-2xs dark:border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <GitCommit className="h-4 w-4 text-emerald-500" /> Recent Squad Commit Cadence
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Chronological stream of recent code changes authored by team members across organization repositories.
                      </CardDescription>
                    </div>
                    {teamCommits.length > 0 && (
                      <span className="text-xs text-slate-400">
                        Showing recent {teamCommits.length} commits
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {commitsQuery.isLoading ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        Loading squad commit cadence...
                      </div>
                    ) : teamCommits.length === 0 ? (
                      <EmptyState
                        icon={<GitCommit className="h-8 w-8 text-slate-400" />}
                        title="No Recent Commits"
                        description="No commits authored by squad members were found in the current organization."
                      />
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {teamCommits.map((commit: TeamCommit) => {
                          const badge = getCommitBadge(commit.classification)
                          return (
                            <div key={commit.id} className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <Avatar
                                  name={commit.developer?.name || commit.authorName}
                                  src={commit.developer?.avatarUrl}
                                  size="sm"
                                  className="mt-0.5 shrink-0"
                                />
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                                      {badge.label}
                                    </span>
                                    {commit.repository && (
                                      <Badge variant="outline" className="text-[10px] py-0 border-slate-300 dark:border-slate-700">
                                        {commit.repository.name}
                                      </Badge>
                                    )}
                                    <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                      {commit.sha.slice(0, 7)}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                                    {commit.message}
                                  </p>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    {commit.developer?.id ? (
                                      <Link
                                        to={`/developers/${commit.developer.id}`}
                                        className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                                      >
                                        {commit.developer.name || commit.authorName}
                                      </Link>
                                    ) : (
                                      <span>{commit.authorName}</span>
                                    )}
                                    <span>&bull;</span>
                                    <span>{formatDate(commit.committedAt)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 text-xs shrink-0 sm:justify-end">
                                <div className="font-mono text-right">
                                  <span className="text-emerald-600 font-medium">+{commit.linesAdded}</span>
                                  <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
                                  <span className="text-rose-600 font-medium">-{commit.linesDeleted}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </QueryState>

      {/* Add Member Modal */}
      <Modal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Add Team Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select User</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Choose an organization member...</option>
              {availableMembers.map((m) => (
                <option key={m.id} value={m.userId || m.user?.id || m.id}>
                  {m.user?.name || m.user?.email || m.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={addMemberMutation.isPending} disabled={!selectedUserId}>Add Member</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Team Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Squad">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Squad Name <span className="text-red-500">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Core Platform" required className="mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="mt-1" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Team Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Team"
        message={`Are you sure you want to delete "${team?.name}"? This action cannot be undone.`}
        confirmText="Delete Team"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Assign Projects Modal */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false)
          setProjectActionError(null)
        }}
        title="Assign Projects to Squad"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select projects for this squad to deliver. Squad contributors will be able to track sprint progress and quality scores for assigned projects.
          </p>

          {projectActionError && (
            <div className="p-3 text-sm rounded bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
              {projectActionError}
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl border-slate-200 dark:border-slate-800 max-h-80 overflow-y-auto">
            {(projectsQuery.data ?? []).map((project) => {
              const isAssigned = (team?.projects ?? []).some((p) => p.id === project.id)
              const isAssigning = assigningProjectId === project.id
              const isUnassigning = unassigningProjectId === project.id

              return (
                <div key={project.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{project.name}</p>
                    <p className="text-xs text-slate-500">SQS {formatScore(project.sqsScore ?? project.sqs)}</p>
                  </div>
                  {isAssigned ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
                        Assigned
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400 h-8 text-xs"
                        isLoading={isUnassigning}
                        disabled={removeProjectMutation.isPending || assignProjectMutation.isPending}
                        onClick={() => removeProjectMutation.mutate(project.id)}
                      >
                        Unassign
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      isLoading={isAssigning}
                      disabled={assignProjectMutation.isPending || removeProjectMutation.isPending}
                      onClick={() => assignProjectMutation.mutate(project.id)}
                    >
                      Assign Project
                    </Button>
                  )}
                </div>
              )
            })}
            {(!projectsQuery.data || projectsQuery.data.length === 0) && (
              <div className="p-6 text-center text-sm text-slate-500">
                <p>No projects found in this organization.</p>
                <Link
                  to="/projects"
                  className="text-indigo-600 hover:underline mt-2 inline-block font-medium"
                  onClick={() => setIsProjectModalOpen(false)}
                >
                  Go to Projects to create a project
                </Link>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsProjectModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
