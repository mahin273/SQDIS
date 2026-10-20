import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Plus,
  ArrowRight,
  Search,
  Edit2,
  Trash2,
  MoreVertical,
  SlidersHorizontal,
  LayoutGrid,
  List,
  GitCommit,
  FolderGit2,
  Eye,
  ShieldCheck,
  UserCheck,
  Award,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
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
import { teamsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatNumber } from '@/lib/utils'
import { PageHeader, QueryState, formatScore } from '../pageUtils'
import type { Team, CreateTeamRequest, UpdateTeamRequest } from '@/types'

function getDqsTier(score?: number | null) {
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
      label: 'Proficient',
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
    label: 'Developing',
    variant: 'destructive' as const,
    color: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  }
}

export function TeamsPage() {
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [dqsFilter, setDqsFilter] = useState<'ALL' | 'ELITE' | 'PROFICIENT' | 'MODERATE' | 'DEVELOPING' | 'UNRATED'>('ALL')
  const [inspectTeam, setInspectTeam] = useState<Team | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'dqs' | 'members' | 'commits'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: () => teamsService.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTeamRequest) => teamsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
      closeModals()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamRequest }) => teamsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
      closeModals()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
      closeModals()
    },
  })

  const rawTeams = teamsQuery.data
  const teams: Team[] = Array.isArray(rawTeams)
    ? rawTeams
    : (rawTeams && typeof rawTeams === 'object' && Array.isArray((rawTeams as any).data))
    ? (rawTeams as any).data
    : (rawTeams && typeof rawTeams === 'object' && Array.isArray((rawTeams as any).teams))
    ? (rawTeams as any).teams
    : []

  const filteredAndSortedTeams = useMemo(() => {
    let result = [...teams]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          (t.lead && (t.lead.name?.toLowerCase().includes(q) || t.lead.email?.toLowerCase().includes(q))) ||
          t.members?.some((m: any) => (m.name || m.email || '').toLowerCase().includes(q)) ||
          t.projects?.some((p: any) => p.name?.toLowerCase().includes(q))
      )
    }

    if (dqsFilter !== 'ALL') {
      result = result.filter((t) => {
        const teamScore = t.avgDqs ?? t.score
        const tier = getDqsTier(teamScore)
        if (dqsFilter === 'ELITE') return tier.label === 'Elite'
        if (dqsFilter === 'PROFICIENT') return tier.label === 'Proficient'
        if (dqsFilter === 'MODERATE') return tier.label === 'Moderate'
        if (dqsFilter === 'DEVELOPING') return tier.label === 'Developing'
        if (dqsFilter === 'UNRATED') return tier.label === 'Unrated'
        return true
      })
    }

    result.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy === 'dqs') {
        comparison = (a.avgDqs ?? a.score ?? 0) - (b.avgDqs ?? b.score ?? 0)
      } else if (sortBy === 'members') {
        comparison = (a.memberCount ?? a.members?.length ?? 0) - (b.memberCount ?? b.members?.length ?? 0)
      } else if (sortBy === 'commits') {
        comparison = (a.commits ?? 0) - (b.commits ?? 0)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [teams, searchQuery, dqsFilter, sortBy, sortOrder])

  // Executive KPI summary calculations
  const totalTeams = teams.length
  const totalMembers = teams.reduce((acc, t) => acc + (t.memberCount ?? t.members?.length ?? 0), 0)
  const ratedTeams = teams.filter((t) => (t.avgDqs ?? t.score ?? 0) > 0)
  const avgDqs =
    ratedTeams.length > 0
      ? ratedTeams.reduce((acc, t) => acc + (t.avgDqs ?? t.score ?? 0), 0) / ratedTeams.length
      : 0
  const avgTier = getDqsTier(avgDqs)
  const totalCommits = teams.reduce((acc, t) => acc + (t.commits ?? 0), 0)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createMutation.mutate({ name, description })
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeam || !name.trim()) return
    updateMutation.mutate({ id: selectedTeam.id, data: { name, description } })
  }

  const handleDelete = () => {
    if (!selectedTeam) return
    deleteMutation.mutate(selectedTeam.id)
  }

  const openCreateModal = () => {
    setName('')
    setDescription('')
    setIsCreateOpen(true)
  }

  const openEditModal = (team: Team) => {
    setSelectedTeam(team)
    setName(team.name)
    setDescription(team.description || '')
    setIsEditOpen(true)
  }

  const openDeleteModal = (team: Team) => {
    setSelectedTeam(team)
    setIsDeleteOpen(true)
  }

  const closeModals = () => {
    setIsCreateOpen(false)
    setIsEditOpen(false)
    setIsDeleteOpen(false)
    setSelectedTeam(null)
    setName('')
    setDescription('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering Teams"
        description="Squad talent intelligence, aggregate Developer Quality Scores (DQS), and project assignments."
        action={
          <Button onClick={openCreateModal} className="gap-2 shadow-xs">
            <Plus className="h-4 w-4" /> Create Team
          </Button>
        }
      />

      {/* 4-Card Executive Squad Banner */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Squads
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {totalTeams}
              </span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                Squads
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {totalTeams > 0 ? 'Delivery teams configured' : 'No squads formed'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Team DQS Index
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                {avgDqs > 0 ? formatScore(avgDqs) : 'Unrated'}
              </span>
              {avgDqs > 0 && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${avgTier.badgeClass}`}>
                  {avgTier.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Collective contributor quality average
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Team Contributors
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {totalMembers}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">engineers</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Active engineering personnel assigned
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Squad Velocity
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
              Authored across linked organization repos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Squad Directory Card */}
      <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
        <CardHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Squad Directory
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {filteredAndSortedTeams.length}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Inspect squad talent, assigned software projects, and aggregate Developer Quality Scores.
              </CardDescription>
            </div>

            {/* Controls Strip: Search, Health Tier Filters, Sort, Grid/Table Switcher */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px] flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search squad, member, or project..."
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
                    Sort: {sortBy === 'dqs' ? 'Team DQS' : sortBy === 'members' ? 'Members' : sortBy === 'commits' ? 'Commits' : 'Name'}
                    <span className="text-[10px] text-slate-400">{sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
                  </Button>
                </DropdownTrigger>
                <DropdownMenu align="end">
                  <DropdownItem onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                    Name {sortBy === 'name' && (sortOrder === 'asc' ? '(Ascending)' : '(Descending)')}
                  </DropdownItem>
                  <DropdownItem onClick={() => { setSortBy('dqs'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                    Team DQS {sortBy === 'dqs' && (sortOrder === 'asc' ? '(Ascending)' : '(Descending)')}
                  </DropdownItem>
                  <DropdownItem onClick={() => { setSortBy('members'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                    Member Count {sortBy === 'members' && (sortOrder === 'asc' ? '(Ascending)' : '(Descending)')}
                  </DropdownItem>
                  <DropdownItem onClick={() => { setSortBy('commits'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}>
                    Total Commits {sortBy === 'commits' && (sortOrder === 'asc' ? '(Ascending)' : '(Descending)')}
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

          {/* DQS Tier Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
              Team DQS Tier:
            </span>
            <button
              type="button"
              onClick={() => setDqsFilter('ALL')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                dqsFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              All ({teams.length})
            </button>
            <button
              type="button"
              onClick={() => setDqsFilter('ELITE')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                dqsFilter === 'ELITE'
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              }`}
            >
              Elite (&gt;= 80)
            </button>
            <button
              type="button"
              onClick={() => setDqsFilter('PROFICIENT')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                dqsFilter === 'PROFICIENT'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
              }`}
            >
              Proficient (70-79)
            </button>
            <button
              type="button"
              onClick={() => setDqsFilter('MODERATE')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                dqsFilter === 'MODERATE'
                  ? 'bg-amber-600 text-white dark:bg-amber-500'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              Moderate (60-69)
            </button>
            <button
              type="button"
              onClick={() => setDqsFilter('DEVELOPING')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                dqsFilter === 'DEVELOPING'
                  ? 'bg-rose-600 text-white dark:bg-rose-500'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              Developing (&lt; 60)
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          <QueryState
            isLoading={teamsQuery.isLoading}
            error={teamsQuery.error}
            onRetry={() => teamsQuery.refetch()}
          >
            {filteredAndSortedTeams.length === 0 ? (
              <EmptyState
                title="No squads match criteria"
                description={
                  searchQuery || dqsFilter !== 'ALL'
                    ? 'Try clearing active filters or refining your search keywords.'
                    : 'Get started by creating your first engineering team.'
                }
                action={
                  searchQuery || dqsFilter !== 'ALL' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('')
                        setDqsFilter('ALL')
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={openCreateModal} className="gap-2">
                      <Plus className="h-4 w-4" /> Create Team
                    </Button>
                  )
                }
              />
            ) : viewMode === 'grid' ? (
              /* Elevated Grid View */
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedTeams.map((team: Team) => {
                  const teamScore = team.avgDqs ?? team.score
                  const tier = getDqsTier(teamScore)
                  const members = team.members ?? []
                  const projects = team.projects ?? []

                  return (
                    <Card
                      key={team.id}
                      className="group relative flex h-full flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md dark:hover:border-blue-600 border-slate-200/90 dark:border-slate-800"
                    >
                      <CardContent className="flex h-full flex-col justify-between p-5">
                        <div className="space-y-3">
                          {/* Top Row: Squad Title, DQS Badge, Menu */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-base font-bold text-slate-900 dark:text-slate-100 truncate block" title={team.name}>
                                {team.name}
                              </span>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[2rem]">
                                {team.description || 'Dedicated engineering squad driving core product capability.'}
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
                                  <DropdownItem onClick={() => openEditModal(team)} className="gap-2">
                                    <Edit2 className="h-4 w-4" /> Edit Details
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={() => openDeleteModal(team)}
                                    className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                  >
                                    <Trash2 className="h-4 w-4" /> Delete Team
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
                            </div>
                          </div>

                          {/* DQS Score & Quality Tier Strip */}
                          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                            <div className="flex items-center gap-2">
                              <Award className={`h-4 w-4 ${tier.color}`} />
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Team DQS
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                                {teamScore && teamScore > 0 ? formatScore(teamScore) : 'Unrated'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tier.badgeClass}`}>
                                {tier.label}
                              </span>
                            </div>
                          </div>

                          {/* Squad Lead Info */}
                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                              Squad Lead:
                            </span>
                            {team.lead ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Avatar
                                  name={team.lead.name || team.lead.email}
                                  src={team.lead.avatarUrl}
                                  className="h-5 w-5"
                                />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                                  {team.lead.name || team.lead.email}
                                </span>
                              </div>
                            ) : (
                              <span className="italic text-slate-400 text-[11px]">Unassigned</span>
                            )}
                          </div>

                          {/* Member Contributor Stack */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <span>Squad Members ({members.length})</span>
                              <span className="flex items-center gap-1">
                                <GitCommit className="h-3 w-3" />
                                {formatNumber(team.commits ?? 0)} commits
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {members.length > 0 ? (
                                <div className="flex -space-x-2 overflow-hidden py-1">
                                  {members.slice(0, 5).map((member: any) => (
                                    <Avatar
                                      key={member.id}
                                      name={member.name || member.email}
                                      src={member.avatarUrl}
                                      className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900"
                                      title={member.name || member.email}
                                    />
                                  ))}
                                  {members.length > 5 && (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-900">
                                      +{members.length - 5}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs italic text-slate-400">No active members</span>
                              )}
                            </div>
                          </div>

                          {/* Assigned Projects */}
                          <div className="space-y-1 pt-1">
                            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <FolderGit2 className="h-3.5 w-3.5 text-blue-500" />
                              Assigned Projects ({projects.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {projects.length > 0 ? (
                                projects.map((p: any) => (
                                  <span
                                    key={p.id}
                                    className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                  >
                                    {p.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs italic text-slate-400">Unassigned to projects</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setInspectTeam(team)}
                            className="flex-1 gap-1.5 text-xs h-8"
                          >
                            <Eye className="h-3.5 w-3.5" /> Quick Inspect
                          </Button>
                          <Link to={`/teams/${team.id}`} className="flex-1">
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full gap-1.5 text-xs h-8"
                            >
                              Team Space <ArrowRight className="h-3.5 w-3.5" />
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
                      <th className="py-3 px-4">Squad Name</th>
                      <th className="py-3 px-4">Team DQS Score</th>
                      <th className="py-3 px-4">Squad Lead</th>
                      <th className="py-3 px-4">Members</th>
                      <th className="py-3 px-4">Assigned Projects</th>
                      <th className="py-3 px-4 text-right">Commit Volume</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {filteredAndSortedTeams.map((team: Team) => {
                      const teamScore = team.avgDqs ?? team.score
                      const tier = getDqsTier(teamScore)
                      const members = team.members ?? []
                      const projects = team.projects ?? []

                      return (
                        <tr
                          key={team.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                          onClick={() => setInspectTeam(team)}
                        >
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">
                              {team.name}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate max-w-xs block mt-0.5">
                              {team.description || 'No description provided.'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {teamScore && teamScore > 0 ? formatScore(teamScore) : 'Unrated'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tier.badgeClass}`}>
                                {tier.label}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {team.lead ? (
                              <div className="flex items-center gap-2">
                                <Avatar
                                  name={team.lead.name || team.lead.email}
                                  src={team.lead.avatarUrl}
                                  className="h-6 w-6"
                                />
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {team.lead.name || team.lead.email}
                                </span>
                              </div>
                            ) : (
                              <span className="italic text-slate-400">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-1.5 overflow-hidden">
                                {members.slice(0, 4).map((m: any) => (
                                  <Avatar
                                    key={m.id}
                                    name={m.name || m.email}
                                    src={m.avatarUrl}
                                    className="h-6 w-6 ring-2 ring-white dark:ring-slate-900"
                                    title={m.name || m.email}
                                  />
                                ))}
                              </div>
                              <span className="font-mono text-slate-500">
                                {members.length} {members.length === 1 ? 'member' : 'members'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {projects.length > 0 ? (
                                projects.map((p: any) => (
                                  <span
                                    key={p.id}
                                    className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                  >
                                    {p.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {formatNumber(team.commits ?? 0)}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setInspectTeam(team)}
                                className="h-7 w-7 p-0"
                                title="Quick Inspect"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                              </Button>
                              <Link to={`/teams/${team.id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Open Team Space"
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
                                  <DropdownItem onClick={() => openEditModal(team)} className="gap-2">
                                    <Edit2 className="h-4 w-4" /> Edit
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={() => openDeleteModal(team)}
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
      <Sheet open={!!inspectTeam} onOpenChange={(open) => !open && setInspectTeam(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-6 flex flex-col justify-between overflow-y-auto">
          {inspectTeam && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle className="text-xl font-bold text-slate-950 dark:text-white">
                      {inspectTeam.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {inspectTeam.description || 'Enterprise delivery engineering squad.'}
                    </SheetDescription>
                  </div>
                  {(() => {
                    const tier = getDqsTier(inspectTeam.avgDqs ?? inspectTeam.score)
                    return (
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${tier.badgeClass}`}>
                        {tier.label}
                      </span>
                    )
                  })()}
                </div>
              </SheetHeader>

              {/* DQS Metric Box */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Average Team DQS
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Rollup across active squad contributors
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-slate-950 dark:text-white">
                      {(inspectTeam.avgDqs ?? inspectTeam.score)
                        ? formatScore(inspectTeam.avgDqs ?? inspectTeam.score)
                        : 'Unrated'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Squad Lead Section */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-2">
                  Designated Squad Lead
                </div>
                {inspectTeam.lead ? (
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={inspectTeam.lead.name || inspectTeam.lead.email}
                      src={inspectTeam.lead.avatarUrl}
                      className="h-10 w-10 ring-2 ring-blue-500/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {inspectTeam.lead.name || inspectTeam.lead.email}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {inspectTeam.lead.email}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No designated squad lead.</div>
                )}
              </div>

              {/* Squad Roster */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-500" /> Squad Contributors
                  </span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {inspectTeam.members?.length ?? 0}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {(inspectTeam.members && inspectTeam.members.length > 0) ? (
                    inspectTeam.members.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={member.name || member.email}
                            src={member.avatarUrl}
                            className="h-7 w-7"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {member.name || member.email}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">
                              {member.email}
                            </div>
                          </div>
                        </div>
                        <Link to={`/developers/${member.id}`} className="text-blue-600 hover:underline text-[11px] font-medium shrink-0">
                          Profile &rarr;
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                      No members assigned to this squad yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned Projects */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <FolderGit2 className="h-4 w-4 text-indigo-500" /> Assigned Projects
                </div>
                {(inspectTeam.projects && inspectTeam.projects.length > 0) ? (
                  <div className="space-y-2">
                    {inspectTeam.projects.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </span>
                        <Link to={`/projects/${p.id}`} className="text-blue-600 hover:underline text-[11px] font-medium">
                          Project View &rarr;
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No projects currently assigned.</div>
                )}
              </div>
            </div>
          )}

          {inspectTeam && (
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <Link to={`/teams/${inspectTeam.id}`} className="w-full">
                <Button className="w-full gap-2">
                  Open Team Workspace <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Team Modal */}
      <Modal isOpen={isCreateOpen} onClose={closeModals} title="Create New Team">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Team Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Core Platform Squad"
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
              placeholder="Optional mission statement or scope..."
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={closeModals}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Team
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Team Modal */}
      <Modal isOpen={isEditOpen} onClose={closeModals} title="Edit Team">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Team Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Core Platform Squad"
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

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={closeModals}
        onConfirm={handleDelete}
        title="Delete Team"
        message={`Are you sure you want to delete the team "${selectedTeam?.name}"? This action cannot be undone and will remove all member assignments.`}
        confirmText="Delete Team"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
