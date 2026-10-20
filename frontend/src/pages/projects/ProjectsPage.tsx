import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FolderGit2,
  Plus,
  ArrowRight,
  ShieldCheck,
  GitBranch,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  SlidersHorizontal,
  Users,
  LayoutGrid,
  List,
  GitCommit,
  Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@/components/ui/dropdown'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { projectsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatNumber } from '@/lib/utils'
import { PageHeader, QueryState, formatScore } from '../pageUtils'
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '@/types'

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

export function ProjectsPage() {
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [healthFilter, setHealthFilter] = useState<'ALL' | 'ELITE' | 'GOOD' | 'MODERATE' | 'NEEDS_ATTENTION' | 'UNRATED'>('ALL')
  const [inspectProject, setInspectProject] = useState<Project | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [key, setKey] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'sqs' | 'repos' | 'commits'>('name')
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
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.key || p.name.slice(0, 4).toUpperCase()).toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.repositories?.some((r: any) => (r.fullName || r.name).toLowerCase().includes(q))
      )
    }

    if (healthFilter !== 'ALL') {
      result = result.filter((p) => {
        const tier = getSqsTier(p.sqsScore ?? p.sqs)
        if (healthFilter === 'ELITE') return tier.label === 'Elite'
        if (healthFilter === 'GOOD') return tier.label === 'Good'
        if (healthFilter === 'MODERATE') return tier.label === 'Moderate'
        if (healthFilter === 'NEEDS_ATTENTION') return tier.label === 'Needs Attention'
        if (healthFilter === 'UNRATED') return tier.label === 'Unrated'
        return true
      })
    }

    result.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy === 'sqs') {
        comparison = (a.sqsScore ?? a.sqs ?? 0) - (b.sqsScore ?? b.sqs ?? 0)
      } else if (sortBy === 'repos') {
        comparison = (a.repositoryCount ?? a.repositories?.length ?? 0) - (b.repositoryCount ?? b.repositories?.length ?? 0)
      } else if (sortBy === 'commits') {
        comparison = (a.totalCommits ?? 0) - (b.totalCommits ?? 0)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [projects, searchQuery, healthFilter, sortBy, sortOrder])

  // Executive KPI summary calculations
  const totalProjects = projects.length
  const ratedProjects = projects.filter((p) => (p.sqsScore ?? p.sqs ?? 0) > 0)
  const avgSqs =
    ratedProjects.length > 0
      ? ratedProjects.reduce((acc, p) => acc + (p.sqsScore ?? p.sqs ?? 0), 0) / ratedProjects.length
      : 0
  const avgTier = getSqsTier(avgSqs)

  const totalRepos = projects.reduce((acc, p) => acc + (p.repositories?.length ?? p.repositoryCount ?? 0), 0)
  const totalCommits = projects.reduce((acc, p) => acc + (p.totalCommits ?? 0), 0)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createMutation.mutate({ name, description, key: key.trim() || undefined })
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject || !name.trim()) return
    updateMutation.mutate({
      id: selectedProject.id,
      data: { name, description, key: key.trim() || undefined },
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
        title="Project Portfolio"
        description="Enterprise oversight of software quality scores, linked repositories, and engineering velocity."
        action={
          <Button onClick={openCreateModal} className="gap-2 shadow-xs">
            <Plus className="h-4 w-4" /> Create Project
          </Button>
        }
      />

      {/* 4-Card Executive KPI Banner */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Projects
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <FolderGit2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {totalProjects}
              </span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                Managed
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {projects.length > 0 ? 'All initiatives currently tracked' : 'No active projects configured'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Portfolio SQS Index
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {avgSqs > 0 ? formatScore(avgSqs) : 'Unrated'}
              </span>
              {avgSqs > 0 && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${avgTier.badgeClass}`}>
                  {avgTier.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {ratedProjects.length} of {totalProjects} projects scored
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Connected Repositories
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <GitBranch className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {totalRepos}
              </span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                Codebases
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Active repository link assignments
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Portfolio Velocity
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <GitCommit className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {formatNumber(totalCommits)}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">commits</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Aggregated across linked codebases
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Workspace Card */}
      <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
        <CardHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Projects Directory
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {filteredAndSortedProjects.length}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Inspect software health scores, linked repositories, and assigned engineering teams.
              </CardDescription>
            </div>

            {/* Controls Strip: Search, Health Tier Filters, Sort, Grid/Table Switcher */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px] flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search project or repository..."
                  className="pl-9 h-9 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Sort Dropdown */}
              <Dropdown>
                <DropdownTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Sort: {sortBy === 'sqs' ? 'SQS Score' : sortBy === 'commits' ? 'Commits' : sortBy === 'repos' ? 'Repositories' : 'Name'}
                    <span className="text-[10px] text-slate-400">{sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
                  </Button>
                </DropdownTrigger>
                <DropdownMenu align="end">
                  <DropdownItem onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                    Name {sortBy === 'name' && (sortOrder === 'asc' ? '(Ascending)' : '(Descending)')}
                  </DropdownItem>
                  <DropdownItem onClick={() => { setSortBy('sqs'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                    SQS Score {sortBy === 'sqs' && (sortOrder === 'asc' ? '(Ascending)' : '(Descending)')}
                  </DropdownItem>
                  <DropdownItem onClick={() => { setSortBy('commits'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                    Total Commits {sortBy === 'commits' && (sortOrder === 'asc' ? '(Ascending)' : '(Descending)')}
                  </DropdownItem>
                  <DropdownItem onClick={() => { setSortBy('repos'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                    Repositories {sortBy === 'repos' && (sortOrder === 'asc' ? '(Ascending)' : '(Descending)')}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>

              {/* Dual View Mode Switcher */}
              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`h-7 px-2.5 rounded-md text-xs transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Grid
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className={`h-7 px-2.5 rounded-md text-xs transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title="Table View"
                >
                  <List className="h-3.5 w-3.5 mr-1" /> Table
                </Button>
              </div>
            </div>
          </div>

          {/* Health Tier Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
              Quality Tier:
            </span>
            <button
              type="button"
              onClick={() => setHealthFilter('ALL')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                healthFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              All ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter('ELITE')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                healthFilter === 'ELITE'
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              }`}
            >
              Elite
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter('GOOD')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                healthFilter === 'GOOD'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
              }`}
            >
              Good
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter('MODERATE')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                healthFilter === 'MODERATE'
                  ? 'bg-amber-600 text-white dark:bg-amber-500'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              Moderate
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter('NEEDS_ATTENTION')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                healthFilter === 'NEEDS_ATTENTION'
                  ? 'bg-rose-600 text-white dark:bg-rose-500'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              Needs Attention
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          <QueryState
            isLoading={projectsQuery.isLoading}
            error={projectsQuery.error}
            onRetry={() => projectsQuery.refetch()}
          >
            {filteredAndSortedProjects.length === 0 ? (
              <EmptyState
                title="No projects match criteria"
                description={
                  searchQuery || healthFilter !== 'ALL'
                    ? 'Try clearing active filters or refining your search keywords.'
                    : 'Get started by creating your first software project.'
                }
                action={
                  searchQuery || healthFilter !== 'ALL' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('')
                        setHealthFilter('ALL')
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={openCreateModal} className="gap-2">
                      <Plus className="h-4 w-4" /> Create Project
                    </Button>
                  )
                }
              />
            ) : viewMode === 'grid' ? (
              /* Elevated Grid View */
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedProjects.map((project: Project) => {
                  const sqsScore = project.sqsScore ?? project.sqs
                  const tier = getSqsTier(sqsScore)
                  const keyFallback = project.key || project.name.slice(0, 4).toUpperCase()
                  const repos = project.repositories ?? []
                  const teams = project.teams ?? []

                  return (
                    <Card
                      key={project.id}
                      className="group relative flex h-full flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md dark:hover:border-blue-600 border-slate-200/90 dark:border-slate-800"
                    >
                      <CardContent className="flex h-full flex-col justify-between p-5">
                        <div className="space-y-3">
                          {/* Top Row: Title, Key, SQS Badge, Dropdown */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-slate-900 dark:text-slate-100 truncate" title={project.name}>
                                  {project.name}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {keyFallback}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[2rem]">
                                {project.description || 'Enterprise software repository initiative.'}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Dropdown>
                                <DropdownTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu align="end">
                                  <DropdownItem onClick={() => openEditModal(project)} className="gap-2">
                                    <Edit2 className="h-4 w-4" /> Edit Details
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={() => openDeleteModal(project)}
                                    className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                  >
                                    <Trash2 className="h-4 w-4" /> Delete Project
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
                            </div>
                          </div>

                          {/* SQS Score & Quality Tier Strip */}
                          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className={`h-4 w-4 ${tier.color}`} />
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                SQS Health
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                                {sqsScore && sqsScore > 0 ? formatScore(sqsScore) : 'Unrated'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tier.badgeClass}`}>
                                {tier.label}
                              </span>
                            </div>
                          </div>

                          {/* Connected Repositories Section */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3.5 w-3.5" />
                                Linked Codebases ({repos.length})
                              </span>
                              <span className="flex items-center gap-1">
                                <GitCommit className="h-3 w-3" />
                                {formatNumber(project.totalCommits ?? 0)} commits
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {repos.length > 0 ? (
                                repos.slice(0, 3).map((r: any) => (
                                  <span
                                    key={r.id || r.name}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    title={r.fullName || r.name}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    {r.name || r.fullName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs italic text-slate-400">
                                  No repositories linked
                                </span>
                              )}
                              {repos.length > 3 && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  +{repos.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Assigned Teams Section */}
                          <div className="space-y-1 pt-1">
                            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <Users className="h-3.5 w-3.5" />
                              Assigned Teams ({teams.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {teams.length > 0 ? (
                                teams.map((t: any) => (
                                  <span
                                    key={t.id || t.name}
                                    className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                  >
                                    {t.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs italic text-slate-400">
                                  Unassigned to teams
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setInspectProject(project)}
                            className="flex-1 gap-1.5 text-xs h-8"
                          >
                            <Eye className="h-3.5 w-3.5" /> Quick Inspect
                          </Button>
                          <Link to={`/projects/${project.id}`} className="flex-1">
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full gap-1.5 text-xs h-8"
                            >
                              Dashboard <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              /* Dense Enterprise Table View */
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Project & Identifier</th>
                      <th className="py-3 px-4">SQS Health Score</th>
                      <th className="py-3 px-4">Connected Repositories</th>
                      <th className="py-3 px-4">Assigned Teams</th>
                      <th className="py-3 px-4 text-right">Commit Volume</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {filteredAndSortedProjects.map((project: Project) => {
                      const sqsScore = project.sqsScore ?? project.sqs
                      const tier = getSqsTier(sqsScore)
                      const keyFallback = project.key || project.name.slice(0, 4).toUpperCase()
                      const repos = project.repositories ?? []
                      const teams = project.teams ?? []

                      return (
                        <tr
                          key={project.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                          onClick={() => setInspectProject(project)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {project.name}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                {keyFallback}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                              {project.description || 'No description provided.'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {sqsScore && sqsScore > 0 ? formatScore(sqsScore) : 'Unrated'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tier.badgeClass}`}>
                                {tier.label}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {repos.length > 0 ? (
                                repos.slice(0, 2).map((r: any) => (
                                  <span
                                    key={r.id || r.name}
                                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 dark:border-slate-700 dark:text-slate-300"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    {r.name || r.fullName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                              {repos.length > 2 && (
                                <span className="text-[10px] text-slate-400">+{repos.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {teams.length > 0 ? (
                                teams.map((t: any) => (
                                  <span
                                    key={t.id || t.name}
                                    className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                                  >
                                    {t.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {formatNumber(project.totalCommits ?? 0)}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setInspectProject(project)}
                                className="h-7 w-7 p-0"
                                title="Quick Inspect"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                              </Button>
                              <Link to={`/projects/${project.id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Open Full Dashboard"
                                >
                                  <ArrowRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </Button>
                              </Link>
                              <Dropdown>
                                <DropdownTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu align="end">
                                  <DropdownItem onClick={() => openEditModal(project)} className="gap-2">
                                    <Edit2 className="h-4 w-4" /> Edit
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={() => openDeleteModal(project)}
                                    className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                  >
                                    <Trash2 className="h-4 w-4" /> Delete
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      {/* Slide-Over Quick Inspection Drawer */}
      <Sheet open={!!inspectProject} onOpenChange={(open) => !open && setInspectProject(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-6 flex flex-col justify-between overflow-y-auto">
          {inspectProject && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <SheetTitle className="text-xl font-bold text-slate-950 dark:text-white">
                        {inspectProject.name}
                      </SheetTitle>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {inspectProject.key || inspectProject.name.slice(0, 4).toUpperCase()}
                      </Badge>
                    </div>
                    <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {inspectProject.description || 'Enterprise repository initiative'}
                    </SheetDescription>
                  </div>
                  {(() => {
                    const tier = getSqsTier(inspectProject.sqsScore ?? inspectProject.sqs)
                    return (
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${tier.badgeClass}`}>
                        {tier.label}
                      </span>
                    )
                  })()}
                </div>
              </SheetHeader>

              {/* SQS Metric Box */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Software Quality Score (SQS)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Aggregated from code health telemetry
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-slate-950 dark:text-white">
                      {(inspectProject.sqsScore ?? inspectProject.sqs)
                        ? formatScore(inspectProject.sqsScore ?? inspectProject.sqs)
                        : 'Unrated'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Connected Repositories Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <FolderGit2 className="h-4 w-4 text-blue-500" /> Linked Repositories
                  </span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {inspectProject.repositories?.length ?? 0}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {(inspectProject.repositories?.length ?? 0) > 0 ? (
                    inspectProject.repositories?.map((r: any) => (
                      <div
                        key={r.id || r.name}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {r.name || r.fullName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {r.fullName}
                          </div>
                        </div>
                        <Badge variant={r.isEnabled ? 'success' : 'secondary'} className="text-[10px]">
                          {r.isEnabled ? 'Synced' : 'Paused'}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                      No repositories connected yet
                    </div>
                  )}
                </div>
              </div>

              {/* Engineering Velocity Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40 text-center">
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {formatNumber(inspectProject.totalCommits ?? 0)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Total Commits
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40 text-center">
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {inspectProject.teams?.length ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Assigned Teams
                  </div>
                </div>
              </div>

              {/* Assigned Teams List */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Users className="h-4 w-4 text-indigo-500" /> Team Assignments
                </div>
                {(inspectProject.teams?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {inspectProject.teams?.map((t: any) => (
                      <span
                        key={t.id || t.name}
                        className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No teams currently assigned.</div>
                )}
              </div>
            </div>
          )}

          {inspectProject && (
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <Link to={`/projects/${inspectProject.id}`} className="w-full">
                <Button className="w-full gap-2">
                  Open Project Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Project Modal */}
      <Modal isOpen={isCreateOpen} onClose={closeModals} title="Create New Project">
        <form onSubmit={handleCreate} className="space-y-4">
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
              placeholder="Optional description of this initiative..."
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
              placeholder={name ? name.slice(0, 4).toUpperCase() : 'e.g. CORE'}
              className="mt-1 font-mono uppercase"
            />
            <p className="text-xs text-slate-500 mt-1">
              Short identifier used for branch and issue tagging.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={closeModals}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal isOpen={isEditOpen} onClose={closeModals} title="Edit Project Details">
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
            <Button type="button" variant="outline" onClick={closeModals}>
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
        onClose={closeModals}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete the project "${selectedProject?.name}"? Associated repository links will be unassigned, but code repositories will not be removed.`}
        confirmText="Delete Project"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
