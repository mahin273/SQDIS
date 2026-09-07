import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ShieldCheck, GitBranch, Layers, Settings, Users, Activity, CalendarDays, BarChart2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { projectsService } from '@/services'
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
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5 text-blue-500" /> Linked Repositories
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(project.repositories ?? []).map((repo) => (
                        <div key={repo.id} className="flex items-center justify-between py-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{repo.name}</p>
                            <p className="text-sm text-slate-500">{repo.fullName || repo.url}</p>
                          </div>
                          <Badge variant="outline">{repo.defaultBranch || 'main'}</Badge>
                        </div>
                      ))}
                      {(!project.repositories || project.repositories.length === 0) && (
                        <div className="py-8 text-center text-slate-500">
                          <GitBranch className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
                          <p>No repositories assigned to this project.</p>
                          <Button variant="link" className="mt-2">Configure Repositories</Button>
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
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-500" /> Associated Teams
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(project.teams ?? []).map(team => (
                        <Link key={team.id} to={`/teams/${team.id}`} className="block p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{team.name}</span>
                            <ArrowLeft className="h-4 w-4 rotate-180 text-slate-400" />
                          </div>
                        </Link>
                      ))}
                      {(!project.teams || project.teams.length === 0) && (
                        <p className="text-center text-sm text-slate-500 py-2">No teams associated yet.</p>
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
    </div>
  )
}
