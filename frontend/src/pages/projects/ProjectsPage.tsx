import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderGit2, Plus, ArrowRight, ShieldCheck, GitBranch, Search, MoreVertical, Edit2, Trash2, SlidersHorizontal, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@/components/ui/dropdown'
import { projectsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState, formatScore } from '../pageUtils'
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '@/types'

export function ProjectsPage() {
  const queryClient = useQueryClient()
  
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [key, setKey] = useState('')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'sqs' | 'repos'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => projectsService.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectRequest) => projectsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      closeModals()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) => projectsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      closeModals()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      closeModals()
    },
  })

  const rawProjects = projectsQuery.data
  const projects: Project[] = Array.isArray(rawProjects)
    ? rawProjects
    : (rawProjects && typeof rawProjects === 'object' && Array.isArray((rawProjects as any).data))
    ? (rawProjects as any).data
    : (rawProjects && typeof rawProjects === 'object' && Array.isArray((rawProjects as any).projects))
    ? (rawProjects as any).projects
    : []
  
  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.key || p.name.slice(0, 4).toUpperCase()).toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
    }
    
    result.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy === 'sqs') {
        comparison = (a.sqsScore ?? a.sqs ?? 0) - (b.sqsScore ?? b.sqs ?? 0)
      } else if (sortBy === 'repos') {
        comparison = (a.repositoryCount ?? a.repositories?.length ?? 0) - (b.repositoryCount ?? b.repositories?.length ?? 0)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    return result
  }, [projectsQuery.data, searchQuery, sortBy, sortOrder])

  const avgSqs = projects.length > 0
    ? projects.reduce((acc, p) => acc + (p.sqsScore ?? p.sqs ?? 0), 0) / projects.length
    : 0

  const totalRepos = projects.reduce((acc, p) => acc + (p.repositories?.length ?? p.repositoryCount ?? 0), 0)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !key.trim()) return
    createMutation.mutate({ name, description, key })
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject || !name.trim()) return
    updateMutation.mutate({ 
      id: selectedProject.id, 
      data: { name, description, key: key || undefined } 
    })
  }

  const handleDelete = () => {
    if (!selectedProject) return
    deleteMutation.mutate(selectedProject.id)
  }

  const openCreateModal = () => {
    setName('')
    setDescription('')
    setKey('')
    setIsCreateOpen(true)
  }

  const openEditModal = (project: Project) => {
    setSelectedProject(project)
    setName(project.name)
    setDescription(project.description || '')
    setKey(project.key || '')
    setIsEditOpen(true)
  }

  const openDeleteModal = (project: Project) => {
    setSelectedProject(project)
    setIsDeleteOpen(true)
  }

  const closeModals = () => {
    setIsCreateOpen(false)
    setIsEditOpen(false)
    setIsDeleteOpen(false)
    setSelectedProject(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Monitor software projects, Software Quality Scores (SQS), and linked repositories."
        action={
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="h-4 w-4" /> Create Project
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Total Projects" value={projects.length} icon={<FolderGit2 className="h-5 w-5" />} />
        <MetricTile label="Average SQS" value={formatScore(avgSqs)} icon={<ShieldCheck className="h-5 w-5" />} />
        <MetricTile
          label="Tracked Repositories"
          value={totalRepos}
          icon={<GitBranch className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All Projects</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search projects..."
                className="pl-9 w-full sm:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> Sort By
                </Button>
              </DropdownTrigger>
              <DropdownMenu align="end">
                <DropdownItem onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </DropdownItem>
                <DropdownItem onClick={() => { setSortBy('sqs'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                  Score {sortBy === 'sqs' && (sortOrder === 'asc' ? '↑' : '↓')}
                </DropdownItem>
                <DropdownItem onClick={() => { setSortBy('repos'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                  Repositories {sortBy === 'repos' && (sortOrder === 'asc' ? '↑' : '↓')}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </CardHeader>
        <CardContent>
          <QueryState isLoading={projectsQuery.isLoading} error={projectsQuery.error} onRetry={() => projectsQuery.refetch()}>
            {filteredAndSortedProjects.length === 0 ? (
              <EmptyState 
                title="No projects found" 
                description={searchQuery ? "Try adjusting your search criteria." : "Create a project to start organizing your repositories."}
                action={!searchQuery && <Button onClick={openCreateModal}>Create Project</Button>}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedProjects.map((project: Project) => (
                  <Card key={project.id} className="group relative flex h-full flex-col transition-all hover:border-blue-300 dark:hover:border-blue-700">
                    <CardContent className="flex h-full flex-col justify-between p-5">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold text-slate-950 dark:text-white truncate" title={project.name}>
                              {project.name}
                            </h2>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{project.key || project.name.slice(0, 4).toUpperCase()}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono">
                              SQS {formatScore(project.sqsScore ?? project.sqs)}
                            </Badge>
                            <Dropdown>
                              <DropdownTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu align="end">
                                <DropdownItem onClick={() => openEditModal(project)} className="gap-2">
                                  <Edit2 className="h-4 w-4" /> Edit
                                </DropdownItem>
                                <DropdownItem onClick={() => openDeleteModal(project)} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50">
                                  <Trash2 className="h-4 w-4" /> Delete
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
                          {project.description || 'No description available.'}
                        </p>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <GitBranch className="h-3.5 w-3.5" />
                            <span>{project.repositories?.length ?? project.repositoryCount ?? 0} Repositories</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            <span>{project.teams?.length ?? project.teamCount ?? 0} Teams</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-2">
                        <Link to={`/projects/${project.id}`}>
                          <Button variant="outline" className="w-full justify-between gap-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40">
                            View Project Details
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      <Modal isOpen={isCreateOpen} onClose={closeModals} title="Create New Project">
        <form onSubmit={handleCreate} className="space-y-4">
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
            <p className="text-xs text-slate-500 mt-1">Unique identifier used for prefixing (e.g., issues, branches).</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={closeModals}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create Project</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={closeModals} title="Edit Project">
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
            <Button type="button" variant="outline" onClick={closeModals}>Cancel</Button>
            <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={closeModals}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete the project "${selectedProject?.name}"? This action cannot be undone and will remove all associated configurations.`}
        confirmText="Delete Project"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
