import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  X,
  LayoutGrid,
  List,
  GitCommit,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Briefcase,
  ExternalLink,
  ChevronRight,
  Award,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { developersService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatDate } from '@/lib/utils'
import { PageHeader, QueryState, formatScore } from '../pageUtils'
import type { Developer } from '@/types'

function getDqsTier(score?: number | null) {
  if (score === null || score === undefined) {
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

export function DevelopersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('ALL')
  const [selectedRole, setSelectedRole] = useState('ALL')
  const [sortBy, setSortBy] = useState<'dqs-desc' | 'dqs-asc' | 'commits-desc' | 'name-asc' | 'activity-desc'>('dqs-desc')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [inspectDeveloper, setInspectDeveloper] = useState<Developer | null>(null)

  const developersQuery = useQuery({
    queryKey: queryKeys.leaderboard.developers({ limit: 100 }),
    queryFn: () => developersService.getAll(),
  })

  const rawDevelopers = developersQuery.data
  const developers: Developer[] = useMemo(() => {
    if (Array.isArray(rawDevelopers)) return rawDevelopers
    if (rawDevelopers && typeof rawDevelopers === 'object' && Array.isArray((rawDevelopers as any).entries)) {
      return (rawDevelopers as any).entries
    }
    return []
  }, [rawDevelopers])

  // Extract distinct teams and roles
  const teamsList = useMemo(() => {
    const set = new Set<string>()
    developers.forEach((d) => {
      if (d.team?.name) set.add(d.team.name)
    })
    return Array.from(set).sort()
  }, [developers])

  const rolesList = useMemo(() => {
    const set = new Set<string>()
    developers.forEach((d) => {
      if (d.role) set.add(d.role)
    })
    return Array.from(set).sort()
  }, [developers])

  // Aggregate Metrics
  const activeCount = developers.filter((d) => d.status === 'ACTIVE').length
  const avgDqs =
    developers.length > 0
      ? developers.reduce((sum, d) => sum + (d.dqs ?? 0), 0) / developers.length
      : 0
  const assignedCount = developers.filter((d) => d.team && d.team.name).length
  const totalCommits = developers.reduce((sum, d) => sum + (d.commitCount ?? 0), 0)

  // Filter & Sort
  const filteredDevelopers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return developers
      .filter((dev) => {
        if (query) {
          const matchName = dev.name?.toLowerCase().includes(query)
          const matchEmail = dev.email?.toLowerCase().includes(query)
          const matchRole = dev.role?.toLowerCase().includes(query)
          const matchTeam = dev.team?.name?.toLowerCase().includes(query)
          if (!matchName && !matchEmail && !matchRole && !matchTeam) return false
        }

        if (selectedTeam !== 'ALL') {
          if (selectedTeam === 'UNASSIGNED') {
            if (dev.team?.name) return false
          } else if (dev.team?.name !== selectedTeam) {
            return false
          }
        }

        if (selectedRole !== 'ALL' && dev.role !== selectedRole) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'dqs-desc') return (b.dqs ?? 0) - (a.dqs ?? 0)
        if (sortBy === 'dqs-asc') return (a.dqs ?? 0) - (b.dqs ?? 0)
        if (sortBy === 'commits-desc') return (b.commitCount ?? 0) - (a.commitCount ?? 0)
        if (sortBy === 'name-asc') return (a.name || a.email).localeCompare(b.name || b.email)
        if (sortBy === 'activity-desc') {
          const dateA = a.lastActive ? new Date(a.lastActive).getTime() : 0
          const dateB = b.lastActive ? new Date(b.lastActive).getTime() : 0
          return dateB - dateA
        }
        return 0
      })
  }, [developers, searchQuery, selectedTeam, selectedRole, sortBy])

  const avgTier = getDqsTier(avgDqs)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Intelligence & Talent Roster"
        description="Engineering capacity, DQS performance tiers, commit footprints, and contributor analytics."
        action={
          <div className="flex items-center gap-2">
            <Link to="/scores">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Award className="h-3.5 w-3.5 text-blue-500" />
                <span>Score Analytics</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* Talent Bench KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Engineers</span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {developers.length}
              </span>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Total mapped contributors
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {activeCount}
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                {developers.length > 0 ? `${Math.round((activeCount / developers.length) * 100)}%` : '0%'} Active
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Contributing code & reviews
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Average DQS</span>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {formatScore(avgDqs)}
              </span>
              <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${avgTier.badgeClass}`}>
                {avgTier.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Organization quality index
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Commit Footprint</span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <GitCommit className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {totalCommits.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">
                {assignedCount}/{developers.length} in Teams
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Authored across repositories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Discovery & Filter Toolbar */}
      <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name, email, or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 pr-8 text-xs bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns & View Mode */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Team Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] font-medium text-slate-400">Team:</span>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="ALL">All Teams</option>
                  {teamsList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="UNASSIGNED">Unassigned</option>
                </select>
              </div>

              {/* Role Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] font-medium text-slate-400">Role:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="ALL">All Roles</option>
                  {rolesList.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] font-medium text-slate-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-8 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="dqs-desc">DQS: Highest First</option>
                  <option value="dqs-asc">DQS: Lowest First</option>
                  <option value="commits-desc">Commits: Most First</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="activity-desc">Recently Active</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-md p-1.5 transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-md p-1.5 transition-all ${
                    viewMode === 'table'
                      ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  title="Table View"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Developer Directory Content */}
      <QueryState
        isLoading={developersQuery.isLoading}
        error={developersQuery.error}
        onRetry={() => developersQuery.refetch()}
      >
        {filteredDevelopers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-800">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              No developers match your filters
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Try adjusting your search query, team, or role selection.
            </p>
            {(searchQuery || selectedTeam !== 'ALL' || selectedRole !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedTeam('ALL')
                  setSelectedRole('ALL')
                }}
                className="mt-4 h-8 text-xs"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Mode */
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredDevelopers.map((dev) => {
              const tier = getDqsTier(dev.dqs)
              return (
                <Card
                  key={dev.id}
                  onClick={() => setInspectDeveloper(dev)}
                  className="group relative flex flex-col justify-between border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:border-blue-400/80 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600/80 cursor-pointer overflow-hidden"
                >
                  <CardContent className="flex flex-col h-full p-4.5">
                    {/* Top Identity Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={dev.name || dev.email}
                          src={dev.avatarUrl}
                          className="h-10 w-10 ring-1 ring-slate-200/80 dark:ring-slate-700 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition-colors">
                            {dev.name}
                          </h3>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {dev.email}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={dev.status === 'ACTIVE' ? 'success' : 'secondary'}
                        className="text-[10px] px-1.5 py-0.2 shrink-0"
                      >
                        {dev.status}
                      </Badge>
                    </div>

                    {/* DQS Metric Badge & Performance Tier */}
                    <div className="my-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Quality Score (DQS)
                        </span>
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${tier.badgeClass}`}>
                          {tier.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                          {formatScore(dev.dqs)}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-medium">
                          {dev.dqsTrend !== null && dev.dqsTrend !== undefined ? (
                            dev.dqsTrend > 0 ? (
                              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-3 w-3 mr-0.5" />
                                +{dev.dqsTrend}
                              </span>
                            ) : dev.dqsTrend < 0 ? (
                              <span className="inline-flex items-center text-rose-600 dark:text-rose-400">
                                <TrendingDown className="h-3 w-3 mr-0.5" />
                                {dev.dqsTrend}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-slate-400">
                                <Minus className="h-3 w-3 mr-0.5" />
                                Stable
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">Baseline</span>
                          )}
                        </div>
                      </div>

                      {/* Mini Score Bar */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (dev.dqs ?? 0) >= 80
                              ? 'bg-emerald-500'
                              : (dev.dqs ?? 0) >= 70
                              ? 'bg-blue-500'
                              : (dev.dqs ?? 0) >= 60
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, dev.dqs ?? 0))}%` }}
                        />
                      </div>
                    </div>

                    {/* Secondary Telemetry Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <GitCommit className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <strong className="font-semibold text-slate-900 dark:text-slate-100">
                            {(dev.commitCount ?? 0).toLocaleString()}
                          </strong>{' '}
                          commits
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {dev.team?.name ? (
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {dev.team.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Footer / Inspection Trigger */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1 truncate">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate text-[11px]">
                          {dev.lastActive ? formatDate(dev.lastActive) : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Inspect</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          /* Table View Mode */
          <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Developer</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">DQS Benchmark</th>
                    <th className="py-3 px-4">Commits</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDevelopers.map((dev) => {
                    const tier = getDqsTier(dev.dqs)
                    return (
                      <tr
                        key={dev.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={dev.name || dev.email}
                              src={dev.avatarUrl}
                              className="h-8 w-8 ring-1 ring-slate-200 dark:ring-slate-700"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {dev.name}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {dev.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {dev.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {dev.team?.name ? (
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {dev.team.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100 w-10">
                              {formatScore(dev.dqs)}
                            </span>
                            <span className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${tier.badgeClass}`}>
                              {tier.label}
                            </span>
                            <div className="h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${
                                  (dev.dqs ?? 0) >= 80
                                    ? 'bg-emerald-500'
                                    : (dev.dqs ?? 0) >= 70
                                    ? 'bg-blue-500'
                                    : (dev.dqs ?? 0) >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, dev.dqs ?? 0))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {(dev.commitCount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                          {dev.lastActive ? formatDate(dev.lastActive) : 'Inactive'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectDeveloper(dev)}
                              className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            >
                              Inspect
                            </Button>
                            <Link to={`/developers/${dev.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                              >
                                <span>Profile</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryState>

      {/* Slide-Over Quick Inspection Drawer */}
      <Sheet open={!!inspectDeveloper} onOpenChange={(open) => !open && setInspectDeveloper(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-6 flex flex-col justify-between overflow-y-auto">
          {inspectDeveloper && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={inspectDeveloper.name || inspectDeveloper.email}
                      src={inspectDeveloper.avatarUrl}
                      className="h-12 w-12 ring-2 ring-blue-500/20"
                    />
                    <div>
                      <SheetTitle className="text-lg font-bold text-slate-950 dark:text-white">
                        {inspectDeveloper.name}
                      </SheetTitle>
                      <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
                        {inspectDeveloper.email}
                      </SheetDescription>
                    </div>
                  </div>
                  <Badge variant={inspectDeveloper.status === 'ACTIVE' ? 'success' : 'secondary'}>
                    {inspectDeveloper.status}
                  </Badge>
                </div>
              </SheetHeader>

              {/* DQS Score Summary Card */}
              {(() => {
                const tier = getDqsTier(inspectDeveloper.dqs)
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Developer Quality Score
                      </span>
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${tier.badgeClass}`}>
                        {tier.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-black text-slate-950 dark:text-white">
                        {formatScore(inspectDeveloper.dqs)}
                      </span>
                      <span className="text-xs text-slate-400">Target Benchmark: 80.0</span>
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          (inspectDeveloper.dqs ?? 0) >= 80
                            ? 'bg-emerald-500'
                            : (inspectDeveloper.dqs ?? 0) >= 70
                            ? 'bg-blue-500'
                            : (inspectDeveloper.dqs ?? 0) >= 60
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, inspectDeveloper.dqs ?? 0))}%` }}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* 4-Tile Quick Matrix */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-slate-400 font-medium">Commits Authored</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {(inspectDeveloper.commitCount ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-slate-400 font-medium">Role Assignment</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {inspectDeveloper.role}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-slate-400 font-medium">Team Affiliation</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {inspectDeveloper.team?.name || 'Unassigned'}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-slate-400 font-medium">Last Active</span>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {inspectDeveloper.lastActive ? formatDate(inspectDeveloper.lastActive) : 'Inactive'}
                  </p>
                </div>
              </div>

              {/* Action Links */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <Link
                  to={`/developers/${inspectDeveloper.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <span>View Full Profile & SHAP Explainability</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <Button
                  variant="outline"
                  onClick={() => setInspectDeveloper(null)}
                  className="w-full h-9 text-xs"
                >
                  Dismiss Drawer
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
