import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ShieldCheck,
  GitBranch,
  Layers,
  Settings,
  Users,
  Activity,
  Trash2,
  Plus,
  Flame,
  FileCode,
  AlertTriangle,
  RefreshCw,
  Clock,
  GitCommit,
  CheckCircle2,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScoreGauge } from '@/components/charts'
import { projectsService, repositoriesService, teamsService, codeIntelligenceService, scoresService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatDate, formatNumber } from '@/lib/utils'
import { QueryState, formatScore } from '../pageUtils'
import type { ProjectMetrics } from '@/types'
import type { RepositoryHotspot } from '@/services'
import { useProjectRealtime } from '@/hooks/useProjectRealtime'

function getSqsTier(score?: number | null) {
  if (score === null || score === undefined || score === 0) {
    return {
      label: 'Unrated',
      variant: 'secondary' as const,
      color: 'text-slate-500 dark:text-slate-400',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    }
  }
  if (score >= 80) {
    return {
      label: 'Elite',
      variant: 'success' as const,
      color: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    }
  }
  if (score >= 70) {
    return {
      label: 'Good',
      variant: 'default' as const,
      color: 'text-blue-600 dark:text-blue-400',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    }
  }
  if (score >= 60) {
    return {
      label: 'Moderate',
      variant: 'warning' as const,
      color: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    }
  }
  return {
    label: 'Needs Attention',
    variant: 'destructive' as const,
    color: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  }
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Realtime updates over WS
  useProjectRealtime(id)

  const [activeTab, setActiveTab] = useState('hotspots')
  const [debtFilter, setDebtFilter] = useState<string>('ALL')
  const [debtSearch, setDebtSearch] = useState<string>('')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [key, setKey] = useState('')

  const projectQuery = useQuery({
    queryKey: queryKeys.projects.detail(id ?? ''),
    queryFn: () => projectsService.getById(id!),
    enabled: !!id,
  })

  const metricsQuery = useQuery({
    queryKey: queryKeys.projects.metrics(id ?? ''),
    queryFn: () => projectsService.getMetrics(id!),
    enabled: !!id,
  })

  const debtQuery = useQuery({
    queryKey: queryKeys.projects.debt(id ?? ''),
    queryFn: () => projectsService.getTechnicalDebt(id!),
    enabled: !!id,
  })

  const recalculateMutation = useMutation({
    mutationFn: () => scoresService.recalculate({ entityId: id!, type: 'SQS' }),
    onSuccess: (data) => {
      toast.success(data?.message || 'SQS score recalculated successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.metrics(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to recalculate SQS score')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; key?: string }) => projectsService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      setIsEditOpen(false)
      toast.success('Project details updated')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => projectsService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      toast.success('Project deleted successfully')
      navigate('/projects')
    },
  })

  const [linkingRepoKey, setLinkingRepoKey] = useState<string | null>(null)
  const [unlinkingRepoKey, setUnlinkingRepoKey] = useState<string | null>(null)
  const [repoActionError, setRepoActionError] = useState<string | null>(null)

  const orgReposQuery = useQuery({
    queryKey: queryKeys.repositories.all(),
    queryFn: () => repositoriesService.getAll(),
  })

  const linkRepoMutation = useMutation({
    mutationFn: async (repo: any) => {
      setRepoActionError(null)
      let targetRepoId = repo.id

      if (!targetRepoId || !repo.isEnabled) {
        try {
          const enabled = await repositoriesService.enable({
            id: repo.id || undefined,
            githubId: repo.githubId,
            name: repo.name,
            fullName: repo.fullName || repo.name,
            backfill: true,
          })
          targetRepoId = enabled?.id || targetRepoId
        } catch (enableErr: any) {
          console.warn('Repository enable warning:', enableErr)
          if (!targetRepoId) {
            targetRepoId = repo.fullName || String(repo.githubId) || repo.name
          }
        }
      }

      if (!targetRepoId) {
        throw new Error('Could not determine repository identifier')
      }

      return await projectsService.assignRepository(id!, { repositoryId: targetRepoId })
    },
    onMutate: (repo: any) => {
      setLinkingRepoKey(repo.id || repo.fullName || String(repo.githubId) || repo.name)
    },
    onSettled: () => {
      setLinkingRepoKey(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.metrics(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
      toast.success('Repository linked to project')
    },
    onError: (err: any) => {
      setRepoActionError(err?.response?.data?.message || err?.message || 'Failed to link repository')
    },
  })

  const removeRepoMutation = useMutation({
    mutationFn: (repoId: string) => {
      setRepoActionError(null)
      return projectsService.removeRepository(id!, repoId)
    },
    onMutate: (repoId: string) => {
      setUnlinkingRepoKey(repoId)
    },
    onSettled: () => {
      setUnlinkingRepoKey(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.metrics(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
      toast.success('Repository unlinked from project')
    },
    onError: (err: any) => {
      setRepoActionError(err?.response?.data?.message || err?.message || 'Failed to unlink repository')
    },
  })

  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null)
  const [unassigningTeamId, setUnassigningTeamId] = useState<string | null>(null)
  const [teamActionError, setTeamActionError] = useState<string | null>(null)

  const orgTeamsQuery = useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: () => teamsService.getAll(),
  })

  const assignTeamMutation = useMutation({
    mutationFn: (teamId: string) => {
      setTeamActionError(null)
      return projectsService.assignTeam(id!, { teamId })
    },
    onMutate: (teamId: string) => {
      setAssigningTeamId(teamId)
    },
    onSettled: () => {
      setAssigningTeamId(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
      toast.success('Team assigned to project')
    },
    onError: (err: any) => {
      setTeamActionError(err?.response?.data?.message || err?.message || 'Failed to assign team')
    },
  })

  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) => {
      setTeamActionError(null)
      return projectsService.removeTeam(id!, teamId)
    },
    onMutate: (teamId: string) => {
      setUnassigningTeamId(teamId)
    },
    onSettled: () => {
      setUnassigningTeamId(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
      toast.success('Team unassigned from project')
    },
    onError: (err: any) => {
      setTeamActionError(err?.response?.data?.message || err?.message || 'Failed to unassign team')
    },
  })

  const project = projectQuery.data
  const metrics = metricsQuery.data as ProjectMetrics | undefined
  const debtRaw = debtQuery.data
  const debtItems: any[] = Array.isArray(debtRaw)
    ? debtRaw
    : ((debtRaw as any)?.items ?? [])

  const linkedRepos = project?.repositories ?? []
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const activeRepoId = selectedRepoId || linkedRepos[0]?.id || linkedRepos[0]?.repositoryId || linkedRepos[0]?.repository?.id || ''

  const hotspotsQuery = useQuery({
    queryKey: ['repository-hotspots', activeRepoId],
    queryFn: () => codeIntelligenceService.getRepositoryHotspots(activeRepoId, 15),
    enabled: !!activeRepoId,
  })
  const hotspots: RepositoryHotspot[] = hotspotsQuery.data || []

  // Filtered technical debt items
  const filteredDebtItems = useMemo(() => {
    let list = debtItems
    if (debtFilter !== 'ALL') {
      list = list.filter((item) => (item.markerType || item.type || '').toUpperCase() === debtFilter)
    }
    if (debtSearch) {
      const q = debtSearch.toLowerCase()
      list = list.filter(
        (item) =>
          (item.filePath || '').toLowerCase().includes(q) ||
          (item.content || item.description || '').toLowerCase().includes(q) ||
          (item.markerType || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [debtItems, debtFilter, debtSearch])

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    updateMutation.mutate({ name, description, key: key.trim() || undefined })
  }

  const openEditModal = () => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
      setKey(project.key || '')
      setIsEditOpen(true)
    }
  }

  const sqsScore = project?.sqsScore ?? project?.sqs ?? metrics?.avgSqs
  const tier = getSqsTier(sqsScore)
  const keyIdentifier = project?.key || (project?.name ? project.name.slice(0, 4).toUpperCase() : 'PROJ')

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Project Portfolio
        </Link>
      </div>

      <QueryState isLoading={projectQuery.isLoading} error={projectQuery.error} onRetry={() => projectQuery.refetch()}>
        {project && (
          <div className="space-y-6">
            {/* Identity Hero Banner with circular ScoreGauge */}
            <Card className="overflow-hidden border-slate-200/90 shadow-xs dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white truncate">
                        {project.name}
                      </h1>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {keyIdentifier}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${tier.badgeClass}`}>
                        {tier.label} Tier
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                      {project.description || 'Enterprise software repository initiative tracked by SQDIS quality intelligence.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" /> Created{' '}
                        {project.createdAt ? formatDate(project.createdAt) : 'N/A'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-blue-500" />
                        {linkedRepos.length} Linked Codebase{linkedRepos.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                        {(project.teams?.length ?? project.teamAssignments?.length ?? 0)} Assigned Team{((project.teams?.length ?? project.teamAssignments?.length ?? 0) !== 1) ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => recalculateMutation.mutate()}
                        isLoading={recalculateMutation.isPending}
                        className="gap-2 text-xs shadow-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Recalculate SQS
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openEditModal}
                        className="gap-1.5 text-xs"
                      >
                        <Settings className="h-3.5 w-3.5" /> Edit Project
                      </Button>
                    </div>
                  </div>

                  {/* Circular ScoreGauge */}
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 shrink-0 min-w-[200px]">
                    <ScoreGauge
                      value={sqsScore ?? 0}
                      label="SQS Quality"
                      size="sm"
                    />
                    <div className="mt-1 text-center">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Software Quality Score
                      </div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {sqsScore && sqsScore > 0 ? `${formatScore(sqsScore)} / 100` : 'Unrated'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4-Card Executive KPI Strip */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Software Quality Score
                    </span>
                    <ShieldCheck className={`h-5 w-5 ${tier.color}`} />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                      {sqsScore && sqsScore > 0 ? formatScore(sqsScore) : 'Unrated'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tier.badgeClass}`}>
                      {tier.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Defect density and maintainability rollup
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Codebase Volume
                    </span>
                    <GitCommit className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                      {formatNumber(metrics?.totalCommits ?? project.totalCommits ?? 0)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">commits</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {metrics?.featureCommits ?? 0} features &middot; {metrics?.bugfixCommits ?? 0} bugfixes
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Active Technical Debt
                    </span>
                    <Layers className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                      {metrics?.technicalDebt?.total ?? debtItems.length}
                    </span>
                    <Badge variant="warning" className="text-[10px] font-mono">
                      Issues
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {metrics?.technicalDebt?.todo ?? 0} TODO &middot; {metrics?.technicalDebt?.fixme ?? 0} FIXME &middot; {metrics?.technicalDebt?.hack ?? 0} HACK
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Linked Ecosystem
                    </span>
                    <GitBranch className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                      {linkedRepos.length}
                    </span>
                    <span className="text-xs text-slate-500">repo &middot; {(project.teams?.length ?? project.teamAssignments?.length ?? 0)} teams</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Active sync with GitHub telemetry
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 4-Tab Operational Workbench */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800">
                <TabsList className="bg-transparent p-0 gap-6">
                  <TabsTrigger
                    value="hotspots"
                    className="relative rounded-none border-b-2 border-transparent px-1 pb-3 text-sm font-semibold text-slate-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 dark:text-slate-400 dark:data-[state=active]:text-blue-400 transition-colors"
                  >
                    <Flame className="h-4 w-4 mr-2 text-rose-500" />
                    Architecture & Hotspots
                  </TabsTrigger>
                  <TabsTrigger
                    value="velocity"
                    className="relative rounded-none border-b-2 border-transparent px-1 pb-3 text-sm font-semibold text-slate-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 dark:text-slate-400 dark:data-[state=active]:text-blue-400 transition-colors"
                  >
                    <GitCommit className="h-4 w-4 mr-2 text-blue-500" />
                    Velocity & Commits
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {metrics?.totalCommits ?? project.totalCommits ?? 0}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="debt"
                    className="relative rounded-none border-b-2 border-transparent px-1 pb-3 text-sm font-semibold text-slate-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 dark:text-slate-400 dark:data-[state=active]:text-blue-400 transition-colors"
                  >
                    <Layers className="h-4 w-4 mr-2 text-amber-500" />
                    Technical Debt Audit
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-mono text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      {metrics?.technicalDebt?.total ?? debtItems.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="governance"
                    className="relative rounded-none border-b-2 border-transparent px-1 pb-3 text-sm font-semibold text-slate-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 dark:text-slate-400 dark:data-[state=active]:text-blue-400 transition-colors"
                  >
                    <Settings className="h-4 w-4 mr-2 text-slate-500" />
                    Codebases & Governance
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB 1: Code Architecture & Hotspots */}
              <TabsContent value="hotspots" className="space-y-4">
                <Card className="border-slate-200/90 dark:border-slate-800">
                  <CardHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Flame className="h-5 w-5 text-rose-500" /> Code Architecture & Defect Hotspots
                      </CardTitle>
                      <CardDescription className="text-xs">
                        NASA AST complexity inspection: McCabe Cyclomatic Complexity, Cognitive Load, and Maintainability Index.
                      </CardDescription>
                    </div>

                    {linkedRepos.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Repository:</span>
                        <select
                          value={activeRepoId}
                          onChange={(e) => setSelectedRepoId(e.target.value)}
                          aria-label="Select repository for hotspots analysis"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {linkedRepos.map((r: any) => {
                            const rId = r.id || r.repositoryId || r.repository?.id
                            const rName = r.name || r.repository?.name || 'Repo'
                            return (
                              <option key={rId} value={rId}>
                                {rName}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-5">
                    {hotspotsQuery.isLoading ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        Analyzing AST complexity and defect risk across project repositories...
                      </div>
                    ) : hotspots.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/90 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="py-3 px-4">File Path & Module</th>
                              <th className="py-3 px-4 text-center">Cyclomatic CC</th>
                              <th className="py-3 px-4 text-center">Cognitive CC</th>
                              <th className="py-3 px-4 text-center">Maintainability (MI)</th>
                              <th className="py-3 px-4 text-right">Defect Risk</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {hotspots.map((file) => (
                              <tr key={file.id || file.filePath} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-3 px-4 font-mono">
                                  <div className="flex items-center gap-2">
                                    <FileCode className="h-4 w-4 text-slate-400 shrink-0" />
                                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-md" title={file.filePath}>
                                      {file.filePath}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {file.cyclomaticComplexity}
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300">
                                  {file.cognitiveComplexity}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`font-mono font-bold ${file.maintainabilityIndex < 65 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {file.maintainabilityIndex?.toFixed(0) ?? 'N/A'}/100
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border"
                                    style={{
                                      backgroundColor:
                                        file.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' :
                                        file.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.1)' :
                                        file.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.1)' :
                                        'rgba(16, 185, 129, 0.1)',
                                      color:
                                        file.riskLevel === 'CRITICAL' ? '#ef4444' :
                                        file.riskLevel === 'HIGH' ? '#f97316' :
                                        file.riskLevel === 'MODERATE' ? '#d97706' :
                                        '#10b981',
                                      borderColor:
                                        file.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' :
                                        file.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.25)' :
                                        file.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.25)' :
                                        'rgba(16, 185, 129, 0.25)',
                                    }}
                                  >
                                    {file.riskLevel === 'CRITICAL' || file.riskLevel === 'HIGH' ? (
                                      <AlertTriangle className="h-3 w-3" />
                                    ) : (
                                      <ShieldCheck className="h-3 w-3" />
                                    )}
                                    {file.riskLevel} {file.defectProbability !== undefined ? `(${(file.defectProbability * 100).toFixed(0)}%)` : ''}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500">
                        <Flame className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          No architecture defect hotspots detected
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          AST complexity metrics will populate automatically as commits and repositories are processed.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 2: Velocity & Commit Stream */}
              <TabsContent value="velocity" className="space-y-4">
                {/* Commit Classification Category Strip */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                    <div className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                      Features
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-blue-950 dark:text-blue-100">
                      {metrics?.featureCommits ?? 0}
                    </div>
                    <div className="text-[11px] text-blue-600/80 dark:text-blue-400">
                      New product capabilities
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <div className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
                      Bug Fixes
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-amber-950 dark:text-amber-100">
                      {metrics?.bugfixCommits ?? 0}
                    </div>
                    <div className="text-[11px] text-amber-600/80 dark:text-amber-400">
                      Defect patches & hotfixes
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <div className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                      Test Suites
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-emerald-950 dark:text-emerald-100">
                      {metrics?.testCommits ?? 0}
                    </div>
                    <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400">
                      Unit, integration & E2E tests
                    </div>
                  </div>

                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900/50 dark:bg-purple-950/30">
                    <div className="text-xs font-semibold uppercase text-purple-700 dark:text-purple-300">
                      Refactoring
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-purple-950 dark:text-purple-100">
                      {metrics?.refactorCommits ?? 0}
                    </div>
                    <div className="text-[11px] text-purple-600/80 dark:text-purple-400">
                      Code debt cleanups
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
                      Documentation
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono text-slate-950 dark:text-slate-100">
                      {metrics?.docsCommits ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Docs & engineering guides
                    </div>
                  </div>
                </div>

                {/* 20-Item Recent Commit Activity Stream */}
                <Card className="border-slate-200/90 dark:border-slate-800">
                  <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Activity className="h-5 w-5 text-blue-500" /> Recent Commit Cadence
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Live stream of recent commits with author attribution and ML classification.
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {metrics?.recentActivity?.length ?? 0} commits
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5">
                    {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {metrics.recentActivity.map((commit: any) => {
                          const classification = commit.classification || 'FEATURE'
                          const classBadgeClass =
                            classification === 'BUGFIX'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                              : classification === 'REFACTOR'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                              : classification === 'TEST'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'

                          return (
                            <div key={commit.id || commit.sha} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <Avatar
                                  name={commit.authorName || commit.developer?.name || commit.authorEmail}
                                  src={commit.developer?.avatarUrl}
                                  className="h-8 w-8 shrink-0 mt-0.5"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                      {commit.authorName || commit.developer?.name || 'Developer'}
                                    </span>
                                    <span className={`px-2 py-0.2 rounded text-[10px] font-semibold border ${classBadgeClass}`}>
                                      {classification}
                                    </span>
                                    {commit.repository?.name && (
                                      <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                        {commit.repository.name}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
                                    {commit.message}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                                    <span className="font-mono text-slate-500">
                                      {commit.sha?.slice(0, 7)}
                                    </span>
                                    <span>&middot;</span>
                                    <span>{commit.committedAt ? formatDate(commit.committedAt) : 'Recent'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center font-mono text-xs">
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  +{formatNumber(commit.linesAdded ?? 0)}
                                </span>
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                  -{formatNumber(commit.linesDeleted ?? 0)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500">
                        <GitCommit className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          No recent commit activity recorded
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 3: Technical Debt Audit */}
              <TabsContent value="debt" className="space-y-4">
                <Card className="border-slate-200/90 dark:border-slate-800">
                  <CardHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Layers className="h-5 w-5 text-amber-500" /> Technical Debt & Risk Audit
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {debtItems.length} unresolved debt markers detected across active codebases.
                        </CardDescription>
                      </div>

                      {/* Filter Chips & Search Input */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[180px]">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            placeholder="Filter file or message..."
                            className="pl-8 h-8 text-xs"
                            value={debtSearch}
                            onChange={(e) => setDebtSearch(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          {['ALL', 'TODO', 'FIXME', 'HACK', 'XXX'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setDebtFilter(type)}
                              className={`rounded-md px-2 py-1 text-xs font-mono font-semibold transition-colors ${
                                debtFilter === type
                                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5">
                    {filteredDebtItems.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredDebtItems.map((item: any, idx: number) => {
                          const marker = (item.markerType || item.type || 'TODO').toUpperCase()
                          const markerBadgeClass =
                            marker === 'FIXME'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                              : marker === 'HACK'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                              : marker === 'XXX'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                              : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'

                          return (
                            <div key={item.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${markerBadgeClass}`}>
                                    {marker}
                                  </span>
                                  <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {item.filePath}
                                    {item.lineNumber ? `:${item.lineNumber}` : ''}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                  {item.content || item.description || 'Marker flagged in source code.'}
                                </p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                {item.author && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Avatar
                                      name={item.author.name}
                                      src={item.author.avatarUrl}
                                      className="h-6 w-6"
                                    />
                                    <span>{item.author.name}</span>
                                  </div>
                                )}
                                <Badge
                                  variant={
                                    item.severity === 'CRITICAL' || item.severity === 'HIGH'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                  className="text-[10px]"
                                >
                                  {item.severity || 'MEDIUM'}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          No matching technical debt markers
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Codebase is free from {debtFilter !== 'ALL' ? debtFilter : 'active'} debt markers.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 4: Codebases & Team Governance */}
              <TabsContent value="governance" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Linked Repositories */}
                  <Card className="border-slate-200/90 dark:border-slate-800">
                    <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-blue-500" /> Linked Repositories
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Code repositories contributing to project SQS.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRepoModalOpen(true)}
                        className="gap-1.5 text-xs h-8"
                      >
                        <Plus className="h-3.5 w-3.5" /> Configure
                      </Button>
                    </CardHeader>
                    <CardContent className="p-5">
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {linkedRepos.map((repo: any) => {
                          const repoId = repo.id || repo.repositoryId || repo.repository?.id
                          const repoName = repo.name || repo.repository?.name || 'Repository'
                          const repoFullName = repo.fullName || repo.repository?.fullName || repo.url || ''
                          const unlinkTarget = repo.assignmentId || repoId

                          return (
                            <div key={repoId || repoName} className="py-3 flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                  {repoName}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{repoFullName}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="success" className="text-[10px]">
                                  Synced
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-slate-400 hover:text-rose-600 h-7 w-7 p-0"
                                  disabled={removeRepoMutation.isPending && unlinkingRepoKey === unlinkTarget}
                                  onClick={() => removeRepoMutation.mutate(unlinkTarget)}
                                  title="Unlink repository"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                        {linkedRepos.length === 0 && (
                          <div className="py-8 text-center text-xs text-slate-400">
                            No repositories linked to this project yet.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Assigned Teams */}
                  <Card className="border-slate-200/90 dark:border-slate-800">
                    <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Users className="h-4 w-4 text-indigo-500" /> Assigned Teams
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Engineering squads with delivery ownership.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsTeamModalOpen(true)}
                        className="gap-1.5 text-xs h-8"
                      >
                        <Plus className="h-3.5 w-3.5" /> Assign Team
                      </Button>
                    </CardHeader>
                    <CardContent className="p-5">
                      <div className="space-y-3">
                        {((project.teams && project.teams.length > 0)
                          ? project.teams
                          : (project.teamAssignments ?? []).map((ta: any) => ta.team)
                        ).filter(Boolean).map((team: any) => (
                          <div
                            key={team.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                          >
                            <Link to={`/teams/${team.id}`} className="flex-1 min-w-0 mr-2">
                              <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">{team.name}</p>
                              {team.description && (
                                <p className="text-[11px] text-slate-500 truncate">{team.description}</p>
                              )}
                            </Link>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-400 hover:text-rose-600 h-7 w-7 p-0"
                                disabled={removeTeamMutation.isPending && unassigningTeamId === team.id}
                                onClick={() => removeTeamMutation.mutate(team.id)}
                                title="Unassign team"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {(!project.teams || project.teams.length === 0) &&
                          (!project.teamAssignments || project.teamAssignments.length === 0) && (
                            <div className="py-8 text-center text-xs text-slate-400">
                              No teams assigned to this project yet.
                            </div>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Project Metadata & Danger Zone */}
                <Card className="border-rose-200 bg-rose-50/20 dark:border-rose-900/50 dark:bg-rose-950/10">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-sm font-bold text-rose-700 dark:text-rose-300">
                      Danger Zone
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Irreversible management actions for this project.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 flex items-center justify-between">
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                      Deleting this project unlinks repository associations and removes aggregated metrics. Raw code repositories and git history in GitHub will not be affected.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeleteOpen(true)}
                      className="border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-800 dark:hover:bg-rose-950/50 text-xs shrink-0"
                    >
                      Delete Project
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </QueryState>

      {/* Edit Project Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Project Details">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Project Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Core API Backend"
              required
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Project Key (Optional)
            </label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="e.g. CORE"
              className="mt-1 font-mono uppercase"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Project"
        message={`Are you sure you want to delete the project "${project?.name}"? This action cannot be undone and will remove all associated configurations.`}
        confirmText="Delete Project"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Configure Repositories Modal */}
      <Modal
        isOpen={isRepoModalOpen}
        onClose={() => {
          setIsRepoModalOpen(false)
          setRepoActionError(null)
        }}
        title="Configure Linked Repositories"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select repositories from your organization to link to this project. Quality scores, metrics, and debt analysis will aggregate data from all linked repositories.
          </p>

          {repoActionError && (
            <div className="p-3 text-sm rounded bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
              {repoActionError}
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-md border-slate-200 dark:border-slate-800 max-h-80 overflow-y-auto">
            {(orgReposQuery.data ?? []).map((repo) => {
              const repoKey = repo.id || repo.fullName || String(repo.githubId) || repo.name
              const assignedObj = (project?.repositories ?? []).find((r: any) => {
                const assignedId = r.id || r.repositoryId || r.repository?.id
                const assignedName = r.fullName || r.repository?.fullName || r.name || r.repository?.name
                return (
                  (repo.id && assignedId === repo.id) ||
                  (repo.fullName && assignedName === repo.fullName) ||
                  (repo.name && assignedName === repo.name)
                )
              })
              const isAssigned = !!assignedObj
              const isLinking = linkingRepoKey === repoKey
              const isUnlinking = unlinkingRepoKey === repo.id || (assignedObj && unlinkingRepoKey === (assignedObj.assignmentId || assignedObj.id))

              return (
                <div key={repoKey} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{repo.name}</p>
                    <p className="text-xs text-slate-500">{repo.fullName || repo.url}</p>
                  </div>
                  {isAssigned ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
                        Linked
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        isLoading={isUnlinking}
                        disabled={removeRepoMutation.isPending || linkRepoMutation.isPending}
                        onClick={() => {
                          const targetId = assignedObj?.assignmentId || assignedObj?.id || assignedObj?.repositoryId || repo.id
                          removeRepoMutation.mutate(targetId)
                        }}
                      >
                        Unlink
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      isLoading={isLinking}
                      disabled={linkRepoMutation.isPending || removeRepoMutation.isPending}
                      onClick={() => linkRepoMutation.mutate(repo)}
                    >
                      Link Repository
                    </Button>
                  )}
                </div>
              )
            })}
            {(!orgReposQuery.data || orgReposQuery.data.length === 0) && (
              <div className="p-6 text-center text-sm text-slate-500">
                <p>No repositories found in this organization.</p>
                <Link
                  to="/settings?tab=repositories"
                  className="text-blue-600 hover:underline mt-2 inline-block font-medium"
                  onClick={() => setIsRepoModalOpen(false)}
                >
                  Go to Settings &rarr; Repositories to connect your GitHub repositories
                </Link>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsRepoModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Assign Teams Modal */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => {
          setIsTeamModalOpen(false)
          setTeamActionError(null)
        }}
        title="Assign Teams to Project"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Assign teams from your organization to work on this project. Team members will have project metrics attributed to their dashboards.
          </p>

          {teamActionError && (
            <div className="p-3 text-sm rounded bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
              {teamActionError}
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-md border-slate-200 dark:border-slate-800 max-h-80 overflow-y-auto">
            {(orgTeamsQuery.data ?? []).map((team) => {
              const assignedTeams = (project?.teams && project.teams.length > 0)
                ? project.teams
                : (project?.teamAssignments ?? []).map((ta: any) => ta.team).filter(Boolean)
              const isAssigned = assignedTeams.some((t: any) => t.id === team.id)
              const isAssigning = assigningTeamId === team.id
              const isUnassigning = unassigningTeamId === team.id

              return (
                <div key={team.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{team.name}</p>
                    <p className="text-xs text-slate-500">
                      {team.description || `${team.memberCount ?? team.members?.length ?? 0} members`}
                    </p>
                  </div>
                  {isAssigned ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
                        Assigned
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        isLoading={isUnassigning}
                        disabled={removeTeamMutation.isPending || assignTeamMutation.isPending}
                        onClick={() => removeTeamMutation.mutate(team.id)}
                      >
                        Unassign
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      isLoading={isAssigning}
                      disabled={assignTeamMutation.isPending || removeTeamMutation.isPending}
                      onClick={() => assignTeamMutation.mutate(team.id)}
                    >
                      Assign Team
                    </Button>
                  )}
                </div>
              )
            })}
            {(!orgTeamsQuery.data || orgTeamsQuery.data.length === 0) && (
              <div className="p-6 text-center text-sm text-slate-500">
                <p>No teams found in this organization.</p>
                <Link
                  to="/teams"
                  className="text-blue-600 hover:underline mt-2 inline-block font-medium"
                  onClick={() => setIsTeamModalOpen(false)}
                >
                  Go to Teams to create a team
                </Link>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsTeamModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
