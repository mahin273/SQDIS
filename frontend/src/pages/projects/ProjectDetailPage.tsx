import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ShieldCheck, GitBranch, Layers, Settings, Users, Activity, CalendarDays, BarChart2, Trash2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { projectsService, repositoriesService, teamsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState, formatScore } from '../pageUtils'
import type { ProjectMetrics } from '@/types'
import { useProjectRealtime } from '@/hooks/useProjectRealtime'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Realtime updates over WS
  useProjectRealtime(id)
  
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

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; key?: string }) => projectsService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id!) })
      setIsEditOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => projectsService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
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

      // If repository has not been enabled in SQDIS yet, enable it first
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
          // Fallback to name/fullName/githubId if enable didn't return an id
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
    },
    onError: (err: any) => {
      setRepoActionError(
        err?.response?.data?.message || err?.message || 'Failed to link repository'
      )
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
    },
    onError: (err: any) => {
      setRepoActionError(
        err?.response?.data?.message || err?.message || 'Failed to unlink repository'
      )
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
    },
    onError: (err: any) => {
      setTeamActionError(
        err?.response?.data?.message || err?.message || 'Failed to assign team'
      )
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
    },
    onError: (err: any) => {
      setTeamActionError(
        err?.response?.data?.message || err?.message || 'Failed to unassign team'
      )
    },
  })

  const project = projectQuery.data
  const metrics = metricsQuery.data as ProjectMetrics | undefined
  const debtRaw = debtQuery.data
  const debtItems: any[] = Array.isArray(debtRaw)
    ? debtRaw
    : ((debtRaw as any)?.items ?? [])

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    updateMutation.mutate({ name, description, key: key || undefined })
  }

  const openEditModal = () => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
      setKey(project.key)
      setIsEditOpen(true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>
      </div>

      <QueryState isLoading={projectQuery.isLoading} error={projectQuery.error} onRetry={() => projectQuery.refetch()}>
        {project && (
          <div className="space-y-6">
            <PageHeader
              title={project.name}
              description={project.description || 'Project details, quality score, and repository configuration.'}
              action={
                <Button variant="outline" onClick={openEditModal} className="gap-2">
                  <Settings className="h-4 w-4" /> Edit Project
                </Button>
              }
            />

            <div className="grid gap-4 md:grid-cols-4">
              <MetricTile label="Software Quality Score" value={formatScore(project.sqsScore ?? project.sqs ?? metrics?.avgSqs)} icon={<ShieldCheck className="h-5 w-5" />} />
              <MetricTile label="Assigned Repositories" value={project.repositories?.length ?? project.repositoryCount ?? 0} icon={<GitBranch className="h-5 w-5" />} />
              <MetricTile label="Total Commits" value={metrics?.totalCommits ?? 0} icon={<Activity className="h-5 w-5" />} />
              <MetricTile label="Active Sprints" value={metrics?.activeSprints ?? project.sprints?.filter(s => s.status === 'ACTIVE').length ?? 0} icon={<CalendarDays className="h-5 w-5" />} />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5 text-blue-500" /> Linked Repositories
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setIsRepoModalOpen(true)} className="gap-1.5">
                      <Settings className="h-3.5 w-3.5" /> Configure
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(project.repositories ?? []).map((repo: any) => {
                        const repoId = repo.id || repo.repositoryId || repo.repository?.id
                        const repoName = repo.name || repo.repository?.name || 'Repository'
                        const repoFullName = repo.fullName || repo.repository?.fullName || repo.url || ''
                        const branch = repo.defaultBranch || repo.repository?.defaultBranch || 'main'
                        const unlinkTarget = repo.assignmentId || repoId
                        return (
                          <div key={repoId || repoName} className="flex items-center justify-between py-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{repoName}</p>
                              <p className="text-sm text-slate-500">{repoFullName}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{branch}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 h-8 w-8 p-0"
                                disabled={removeRepoMutation.isPending && unlinkingRepoKey === unlinkTarget}
                                onClick={() => removeRepoMutation.mutate(unlinkTarget)}
                                title="Unlink repository"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                      {(!project.repositories || project.repositories.length === 0) && (
                        <div className="py-8 text-center text-slate-500">
                          <GitBranch className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
                          <p>No repositories assigned to this project.</p>
                          <Button variant="link" className="mt-2" onClick={() => setIsRepoModalOpen(true)}>Configure Repositories</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-amber-500" /> Technical Debt Summary
                    </CardTitle>
                    <Badge variant="secondary">{debtItems.length} issues</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {debtItems.map((item, idx) => (
                        <div key={item.id || idx} className="flex items-center justify-between py-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <div className="pr-4">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{item.title || item.markerType || item.type || 'Debt Item'}</p>
                            <p className="text-sm text-slate-500 line-clamp-1">{item.description || item.content || item.filePath || 'File issue'}</p>
                          </div>
                          <Badge 
                            variant={item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'destructive' : item.severity === 'MEDIUM' ? 'default' : 'secondary'}
                            className="shrink-0"
                          >
                            {item.severity || 'MEDIUM'}
                          </Badge>
                        </div>
                      ))}
                      {debtItems.length === 0 && (
                        <div className="py-8 text-center text-slate-500">
                          <ShieldCheck className="mx-auto h-8 w-8 text-green-500/50 mb-3" />
                          <p>No active technical debt recorded for this project.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Project Key</span>
                      <p className="mt-1 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {project.key}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Created At</span>
                      <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                        {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    {metrics && (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                        <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100 mb-2">
                          <BarChart2 className="h-4 w-4" /> Activity Overview
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Avg Velocity</span>
                          <span className="font-medium">{metrics.avgVelocity ?? 0} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Total Sprints</span>
                          <span className="font-medium">{metrics.totalSprints ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Total Tech Debt</span>
                          <span className="font-medium text-amber-600 dark:text-amber-500">{metrics.totalDebt ?? 0}</span>
                        </div>
                      </div>
                    )}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50" onClick={() => setIsDeleteOpen(true)}>
                        Delete Project
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-500" /> Associated Teams
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setIsTeamModalOpen(true)} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Assign Team
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {((project.teams && project.teams.length > 0)
                        ? project.teams
                        : (project.teamAssignments ?? []).map((ta: any) => ta.team)
                      ).filter(Boolean).map((team: any) => (
                        <div key={team.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                          <Link to={`/teams/${team.id}`} className="flex-1 min-w-0 mr-2">
                            <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{team.name}</p>
                            {team.description && (
                              <p className="text-xs text-slate-500 truncate">{team.description}</p>
                            )}
                          </Link>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 h-8 w-8 p-0"
                              disabled={removeTeamMutation.isPending && unassigningTeamId === team.id}
                              onClick={() => removeTeamMutation.mutate(team.id)}
                              title="Unassign team"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Link to={`/teams/${team.id}`} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                              <ArrowLeft className="h-4 w-4 rotate-180" />
                            </Link>
                          </div>
                        </div>
                      ))}
                      {(!project.teams || project.teams.length === 0) &&
                       (!project.teamAssignments || project.teamAssignments.length === 0) && (
                        <div className="py-8 text-center text-slate-500">
                          <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
                          <p>No teams associated yet.</p>
                          <Button variant="link" className="mt-2" onClick={() => setIsTeamModalOpen(true)}>Assign Team</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </QueryState>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Project">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Project Name <span className="text-red-500">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Core API Backend" required className="mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Project Key <span className="text-red-500">*</span></label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="e.g. CORE"
              required
              className="mt-1 font-mono uppercase"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>

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
