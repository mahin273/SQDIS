import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy,
  Medal,
  Crown,
  Award,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Users,
  Layers,
  ShieldCheck,
  GitCommit,
  ChevronRight,
  LayoutGrid,
  List,
  Sparkles,
  Target,
  ExternalLink,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PeriodSelector } from '@/components/ui/period-selector'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { developersService, teamsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { QueryState, formatScore } from './pageUtils'

import type { LeaderboardEntry, TeamLeaderboardEntry } from '@/types'

type Period = 'week' | 'month' | 'quarter' | 'year' | 'all'
type LeaderboardScope = 'developers' | 'teams'
type ViewMode = 'table' | 'grid'
type SortField = 'rank' | 'dqs' | 'commits' | 'reviews' | 'coverage' | 'streak'

function getDqsTier(score?: number | null) {
  if (score === null || score === undefined) {
    return {
      label: 'Unrated',
      variant: 'secondary' as const,
      color: 'text-slate-500 dark:text-slate-400',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      barColor: 'bg-slate-400',
    }
  }
  if (score >= 80) {
    return {
      label: 'Elite',
      variant: 'success' as const,
      color: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      barColor: 'bg-emerald-500',
    }
  }
  if (score >= 70) {
    return {
      label: 'Proficient',
      variant: 'default' as const,
      color: 'text-blue-600 dark:text-blue-400',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      barColor: 'bg-blue-500',
    }
  }
  if (score >= 60) {
    return {
      label: 'Moderate',
      variant: 'warning' as const,
      color: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      barColor: 'bg-amber-500',
    }
  }
  return {
    label: 'Developing',
    variant: 'secondary' as const,
    color: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    barColor: 'bg-rose-500',
  }
}

export function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [scope, setScope] = useState<LeaderboardScope>('developers')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('rank')
  const [inspectEntry, setInspectEntry] = useState<LeaderboardEntry | null>(null)

  // 1. Fetch Developer Leaderboard
  const devLeaderboardQuery = useQuery({
    queryKey: queryKeys.leaderboard.developers({ period, limit: 50 }),
    queryFn: () => developersService.getLeaderboard({ period, limit: 50 }),
    enabled: scope === 'developers',
  })

  // 2. Fetch Team Leaderboard
  const teamLeaderboardQuery = useQuery({
    queryKey: queryKeys.leaderboard.teams({ period }),
    queryFn: () => teamsService.getLeaderboard({ period }),
    enabled: scope === 'teams',
  })

  // Developer entries normalized
  const rawDevs = devLeaderboardQuery.data
  const devEntries: LeaderboardEntry[] = useMemo(() => {
    if (Array.isArray(rawDevs)) return rawDevs
    if (rawDevs && typeof rawDevs === 'object' && Array.isArray((rawDevs as any).entries)) {
      return (rawDevs as any).entries
    }
    return []
  }, [rawDevs])

  // Team entries normalized
  const rawTeams = teamLeaderboardQuery.data
  const teamEntries: TeamLeaderboardEntry[] = useMemo(() => {
    let list: any[] = []
    if (rawTeams && Array.isArray(rawTeams.data)) {
      list = rawTeams.data
    } else if (rawTeams && typeof rawTeams === 'object' && Array.isArray((rawTeams as any).teams)) {
      list = (rawTeams as any).teams
    } else if (rawTeams && typeof rawTeams === 'object' && Array.isArray((rawTeams as any).entries)) {
      list = (rawTeams as any).entries
    } else if (Array.isArray(rawTeams)) {
      list = rawTeams
    }

    return list.map((t: any) => ({
      teamId: t.teamId || t.id || '',
      name: t.name || t.teamName || 'Squad',
      avgDqs: t.aggregatedDQS ?? t.avgDqs ?? 0,
      memberCount: t.memberCount ?? 0,
      rank: t.rank ?? 0,
      ...t,
    }))
  }, [rawTeams])

  const filteredTeams = useMemo(() => {
    return teamEntries.filter((team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [teamEntries, searchTerm])

  // Filtered & Sorted Developer entries
  const filteredDevs = useMemo(() => {
    let list = devEntries.filter((dev) => {
      const matchSearch =
        dev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dev as any).developerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dev as any).teamNames?.some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase()))
      return matchSearch
    })

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'dqs':
          return (b.dqs || 0) - (a.dqs || 0)
        case 'commits':
          return (b.commits || 0) - (a.commits || 0)
        case 'reviews':
          return (b.reviews || 0) - (a.reviews || 0)
        case 'coverage':
          return (b.coverage || 0) - (a.coverage || 0)
        case 'streak':
          return ((b as any).streak || 0) - ((a as any).streak || 0)
        case 'rank':
        default:
          return (a.rank || 0) - (b.rank || 0)
      }
    })

    return list
  }, [devEntries, searchTerm, sortBy])

  // Executive KPI summary calculations
  const totalRanked = devEntries.length
  const topChampion = devEntries[0] || null
  const avgDqs = useMemo(() => {
    if (!devEntries.length) return 0
    const sum = devEntries.reduce((acc, curr) => acc + (curr.dqs || 0), 0)
    return Math.round((sum / devEntries.length) * 10) / 10
  }, [devEntries])
  const topStreak = useMemo(() => {
    return Math.max(...devEntries.map((d) => (d as any).streak || 0), 0)
  }, [devEntries])

  // Top 3 Podium
  const rank1 = devEntries.find((e) => e.rank === 1) || devEntries[0]
  const rank2 = devEntries.find((e) => e.rank === 2) || devEntries[1]
  const rank3 = devEntries.find((e) => e.rank === 3) || devEntries[2]
  const hasPodium = devEntries.length >= 3 && !searchTerm

  return (
    <div className="space-y-6">
      {/* SaaS Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Engineering Quality & Velocity Arena
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Talent rankings, DQS tier standings, peer review turnaround, and commit cadence.
                </p>
              </div>
            </div>
          </div>

          {/* Scope & Period Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Scope Switcher Tabs */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setScope('developers')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  scope === 'developers'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Engineers</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('teams')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  scope === 'teams'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Squads</span>
              </button>
            </div>

            {/* Time Period Filter */}
            <PeriodSelector value={period} onChange={(value) => setPeriod(value as Period)} />
          </div>
        </div>
      </div>

      {/* 4-Card Executive KPI Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Metric 1: Total Evaluated Contributors */}
        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Ranked Engineers
              </span>
              <span className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {totalRanked}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Active Contributors
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>100% Quality Audited</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Quality Champion */}
        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Quality Champion
              </span>
              <span className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <Crown className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              {topChampion ? (
                <>
                  <Avatar
                    name={topChampion.name}
                    src={topChampion.avatarUrl}
                    className="h-8 w-8 ring-1 ring-amber-400"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                      {topChampion.name}
                    </p>
                    <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                      DQS {formatScore(topChampion.dqs)}
                    </p>
                  </div>
                </>
              ) : (
                <span className="text-sm text-slate-500">Evaluating...</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Rank #1 Leaderboard</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Organization Average DQS */}
        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Organization Avg DQS
              </span>
              <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Target className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {avgDqs}
              </span>
              <Badge
                variant={getDqsTier(avgDqs).variant}
                className={`text-[10px] px-1.5 py-0.2 ${getDqsTier(avgDqs).badgeClass}`}
              >
                {getDqsTier(avgDqs).label}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Benchmark Quality Baseline</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Longest Active Streak */}
        <Card className="border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Top Active Streak
              </span>
              <span className="rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                <Flame className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {topStreak}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Consecutive Days
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
              <GitCommit className="h-3.5 w-3.5" />
              <span>Continuous Delivery</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Podium Showcase (Only in Developers mode with >= 3 entries) */}
      {scope === 'developers' && hasPodium && (
        <div className="relative rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/50 to-white p-6 shadow-xs dark:border-slate-800 dark:from-slate-950/40 dark:to-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Award className="h-4 w-4 text-amber-500" />
              <span>Honor Roll Podium</span>
            </div>
            <span className="text-xs text-slate-400">Click any champion to inspect</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
            {/* Rank 2: Silver */}
            {rank2 && (
              <div
                onClick={() => setInspectEntry(rank2)}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-300/80 bg-white p-5 shadow-xs transition-all hover:border-slate-400 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/90 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200 shadow-inner">
                    <Medal className="h-3.5 w-3.5 text-slate-400" />
                    <span>#2 Silver</span>
                  </span>
                  <Badge variant={getDqsTier(rank2.dqs).variant} className="text-[10px]">
                    {getDqsTier(rank2.dqs).label}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-col items-center text-center">
                  <Avatar
                    name={rank2.name}
                    src={rank2.avatarUrl}
                    className="h-16 w-16 ring-4 ring-slate-300 dark:ring-slate-600 shadow-md transition-transform group-hover:scale-105"
                  />
                  <h3 className="mt-3 font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {rank2.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(rank2 as any).developerEmail || (rank2 as any).teamNames?.[0] || 'Contributor'}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-50 p-2.5 text-center dark:bg-slate-950/60">
                  <div>
                    <p className="text-[10px] text-slate-400">DQS</p>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {formatScore(rank2.dqs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Commits</p>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {rank2.commits}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Coverage</p>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {formatScore(rank2.coverage)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 1: Gold Champion (Elevated & Crowned) */}
            {rank1 && (
              <div
                onClick={() => setInspectEntry(rank1)}
                className="group relative flex flex-col justify-between rounded-xl border-2 border-amber-400/90 bg-gradient-to-b from-amber-500/10 via-white to-white p-6 shadow-md transition-all hover:border-amber-400 hover:shadow-xl dark:border-amber-500/80 dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 cursor-pointer md:-translate-y-2"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-400/30 shadow-xs">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span>#1 Gold Champion</span>
                  </span>
                  <Badge variant="success" className="text-[10px] bg-emerald-500 text-white">
                    Top Performer
                  </Badge>
                </div>

                <div className="mt-4 flex flex-col items-center text-center">
                  <div className="relative">
                    <Avatar
                      name={rank1.name}
                      src={rank1.avatarUrl}
                      className="h-20 w-20 ring-4 ring-amber-400 shadow-xl transition-transform group-hover:scale-105"
                    />
                    <span className="absolute -top-2.5 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-md">
                      <Trophy className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-slate-950 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {rank1.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(rank1 as any).developerEmail || (rank1 as any).teamNames?.[0] || 'Contributor'}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-amber-500/5 p-3 text-center border border-amber-400/20 dark:bg-amber-500/10">
                  <div>
                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">DQS</p>
                    <p className="font-mono text-base font-extrabold text-slate-950 dark:text-white">
                      {formatScore(rank1.dqs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Commits</p>
                    <p className="font-mono text-base font-extrabold text-slate-950 dark:text-white">
                      {rank1.commits}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Coverage</p>
                    <p className="font-mono text-base font-extrabold text-slate-950 dark:text-white">
                      {formatScore(rank1.coverage)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 3: Bronze */}
            {rank3 && (
              <div
                onClick={() => setInspectEntry(rank3)}
                className="group relative flex flex-col justify-between rounded-xl border border-amber-800/30 bg-white p-5 shadow-xs transition-all hover:border-amber-700/60 hover:shadow-md dark:border-amber-800/40 dark:bg-slate-900/90 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
                    <Medal className="h-3.5 w-3.5 text-amber-600" />
                    <span>#3 Bronze</span>
                  </span>
                  <Badge variant={getDqsTier(rank3.dqs).variant} className="text-[10px]">
                    {getDqsTier(rank3.dqs).label}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-col items-center text-center">
                  <Avatar
                    name={rank3.name}
                    src={rank3.avatarUrl}
                    className="h-16 w-16 ring-4 ring-amber-700/40 dark:ring-amber-700/60 shadow-md transition-transform group-hover:scale-105"
                  />
                  <h3 className="mt-3 font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {rank3.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(rank3 as any).developerEmail || (rank3 as any).teamNames?.[0] || 'Contributor'}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-50 p-2.5 text-center dark:bg-slate-950/60">
                  <div>
                    <p className="text-[10px] text-slate-400">DQS</p>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {formatScore(rank3.dqs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Commits</p>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {rank3.commits}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Coverage</p>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {formatScore(rank3.coverage)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roster Controls: Search, Sort, View Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={
              scope === 'developers'
                ? 'Search engineers by name, email, or team...'
                : 'Search squads by name...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white dark:bg-slate-900"
          />
        </div>

        <div className="flex items-center gap-3">
          {scope === 'developers' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                aria-label="Sort leaderboard entries"
                className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="rank">Rank (DQS Highest)</option>
                <option value="commits">Total Commits (Velocity)</option>
                <option value="reviews">Reviews Given (Peer Review)</option>
                <option value="coverage">Test Coverage %</option>
                <option value="streak">Active Streak (Consistency)</option>
              </select>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Detailed Table View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Roster Body */}
      {scope === 'developers' ? (
        <QueryState
          isLoading={devLeaderboardQuery.isLoading}
          error={devLeaderboardQuery.error}
          onRetry={() => devLeaderboardQuery.refetch()}
        >
          {viewMode === 'table' ? (
            /* Table Mode */
            <Card className="overflow-hidden border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-16 text-center">Rank</th>
                      <th className="py-3 px-4">Engineer</th>
                      <th className="py-3 px-4">Squad</th>
                      <th className="py-3 px-4">Quality Score (DQS)</th>
                      <th className="py-3 px-4">Trend</th>
                      <th className="py-3 px-4">Commits</th>
                      <th className="py-3 px-4">Reviews</th>
                      <th className="py-3 px-4">Coverage</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDevs.map((dev) => {
                      const tier = getDqsTier(dev.dqs)
                      return (
                        <tr
                          key={dev.userId}
                          onClick={() => setInspectEntry(dev)}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          {/* Rank Badge */}
                          <td className="py-3 px-4 text-center">
                            {dev.rank === 1 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-extrabold text-xs shadow-xs">
                                1
                              </span>
                            ) : dev.rank === 2 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-100 font-extrabold text-xs shadow-xs">
                                2
                              </span>
                            ) : dev.rank === 3 ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/80 text-white font-extrabold text-xs shadow-xs">
                                3
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                #{dev.rank}
                              </span>
                            )}
                          </td>

                          {/* Engineer Identity & Avatar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                name={dev.name}
                                src={dev.avatarUrl}
                                className={`h-9 w-9 shrink-0 ${
                                  dev.rank === 1
                                    ? 'ring-2 ring-amber-400'
                                    : dev.rank === 2
                                    ? 'ring-2 ring-slate-300'
                                    : dev.rank === 3
                                    ? 'ring-2 ring-amber-700/60'
                                    : 'ring-1 ring-slate-200 dark:ring-slate-700'
                                }`}
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition-colors truncate">
                                  {dev.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {(dev as any).developerEmail || (dev as any).email || 'Engineer'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Squad / Team */}
                          <td className="py-3 px-4">
                            {(dev as any).teamNames && (dev as any).teamNames.length > 0 ? (
                              <Badge variant="outline" className="text-[11px] font-mono">
                                {(dev as any).teamNames[0]}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">Unassigned</span>
                            )}
                          </td>

                          {/* DQS Score Bar */}
                          <td className="py-3 px-4 min-w-[140px]">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {formatScore(dev.dqs)}
                                </span>
                                <Badge
                                  variant={tier.variant}
                                  className={`text-[9px] px-1.5 py-0 ${tier.badgeClass}`}
                                >
                                  {tier.label}
                                </Badge>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${tier.barColor}`}
                                  style={{ width: `${Math.min(100, dev.dqs || 0)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Trend */}
                          <td className="py-3 px-4">
                            {dev.trend > 0 ? (
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-3.5 w-3.5" />
                                +{dev.trend}
                              </span>
                            ) : dev.trend < 0 ? (
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                                <TrendingDown className="h-3.5 w-3.5" />
                                {dev.trend}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400">
                                <Minus className="h-3.5 w-3.5" />
                                Stable
                              </span>
                            )}
                          </td>

                          {/* Commits */}
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {dev.commits}
                            </span>
                          </td>

                          {/* Reviews */}
                          <td className="py-3 px-4">
                            <div className="text-xs">
                              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                                {dev.reviews}
                              </span>
                              {(dev as any).avgReviewTurnaround ? (
                                <span className="ml-1 text-[10px] text-slate-400">
                                  ({(dev as any).avgReviewTurnaround}h)
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Coverage */}
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {formatScore(dev.coverage)}%
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-4 text-right">
                            <Link
                              to={`/developers/${dev.userId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <span>Profile</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* Grid View */
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredDevs.map((dev) => {
                const tier = getDqsTier(dev.dqs)
                return (
                  <Card
                    key={dev.userId}
                    onClick={() => setInspectEntry(dev)}
                    className="group relative flex flex-col justify-between border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:border-blue-400/80 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600/80 cursor-pointer overflow-hidden"
                  >
                    <CardContent className="flex flex-col h-full p-4.5 space-y-4">
                      {/* Identity Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            name={dev.name}
                            src={dev.avatarUrl}
                            className="h-10 w-10 ring-1 ring-slate-200/80 dark:ring-slate-700 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition-colors">
                              {dev.name}
                            </h3>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {(dev as any).developerEmail || (dev as any).email || 'Engineer'}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={dev.rank <= 3 ? 'warning' : 'secondary'}
                          className="text-[10px] px-1.5 py-0.2 shrink-0 font-mono"
                        >
                          #{dev.rank}
                        </Badge>
                      </div>

                      {/* DQS Score Bar */}
                      <div className="space-y-1.5 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Quality Score
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {formatScore(dev.dqs)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${tier.barColor}`}
                            style={{ width: `${Math.min(100, dev.dqs || 0)}%` }}
                          />
                        </div>
                      </div>

                      {/* Metric Triad */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-slate-50/80 py-1.5 dark:bg-slate-950/40">
                          <p className="text-[10px] text-slate-400">Commits</p>
                          <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {dev.commits}
                          </p>
                        </div>
                        <div className="rounded-md bg-slate-50/80 py-1.5 dark:bg-slate-950/40">
                          <p className="text-[10px] text-slate-400">Reviews</p>
                          <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {dev.reviews}
                          </p>
                        </div>
                        <div className="rounded-md bg-slate-50/80 py-1.5 dark:bg-slate-950/40">
                          <p className="text-[10px] text-slate-400">Coverage</p>
                          <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatScore(dev.coverage)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </QueryState>
      ) : (
        /* Team Leaderboard Mode */
        <QueryState
          isLoading={teamLeaderboardQuery.isLoading}
          error={teamLeaderboardQuery.error}
          onRetry={() => teamLeaderboardQuery.refetch()}
        >
          <Card className="overflow-hidden border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Squad Name</th>
                    <th className="py-3 px-4">Squad DQS Average</th>
                    <th className="py-3 px-4">Active Members</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTeams.map((team) => (
                    <tr
                      key={team.teamId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-center">
                        <Badge variant={team.rank <= 3 ? 'warning' : 'secondary'} className="font-mono">
                          #{team.rank}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {team.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {formatScore(team.avgDqs)}
                          </span>
                          <Badge variant={getDqsTier(team.avgDqs).variant} className="text-[10px]">
                            {getDqsTier(team.avgDqs).label}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {team.memberCount} members
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/teams/${team.teamId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <span>Squad Details</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </QueryState>
      )}

      {/* Slide-Over Quick Inspection Drawer (Radix Sheet) */}
      <Sheet open={!!inspectEntry} onOpenChange={(open) => !open && setInspectEntry(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-6 flex flex-col justify-between overflow-y-auto">
          {inspectEntry && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={inspectEntry.name}
                      src={inspectEntry.avatarUrl}
                      className="h-14 w-14 ring-2 ring-blue-500/20 shadow-md"
                    />
                    <div>
                      <SheetTitle className="text-xl font-bold text-slate-950 dark:text-white">
                        {inspectEntry.name}
                      </SheetTitle>
                      <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
                        {(inspectEntry as any).developerEmail || (inspectEntry as any).email || 'Engineering Contributor'}
                      </SheetDescription>
                    </div>
                  </div>
                  <Badge variant={inspectEntry.rank <= 3 ? 'warning' : 'secondary'} className="font-mono">
                    #{inspectEntry.rank}
                  </Badge>
                </div>
              </SheetHeader>

              {/* DQS Score Deep Dive */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Developer Quality Score
                  </span>
                  <Badge
                    variant={getDqsTier(inspectEntry.dqs).variant}
                    className={`text-xs px-2 py-0.5 ${getDqsTier(inspectEntry.dqs).badgeClass}`}
                  >
                    {getDqsTier(inspectEntry.dqs).label}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-950 dark:text-white font-mono">
                    {formatScore(inspectEntry.dqs)}
                  </span>
                  <span className="text-xs text-slate-400">/ 100 benchmark index</span>
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getDqsTier(inspectEntry.dqs).barColor}`}
                    style={{ width: `${Math.min(100, inspectEntry.dqs || 0)}%` }}
                  />
                </div>
              </div>

              {/* 4-Tile Performance Telemetry */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="text-[11px] text-slate-400">Authored Commits</span>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
                    {inspectEntry.commits}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="text-[11px] text-slate-400">Peer Reviews Given</span>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
                    {inspectEntry.reviews}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="text-[11px] text-slate-400">Test Coverage</span>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
                    {formatScore(inspectEntry.coverage)}%
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="text-[11px] text-slate-400">Active Commit Streak</span>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
                    {(inspectEntry as any).streak || 0} days
                  </p>
                </div>
              </div>

              {/* Action Link to Full Workbench */}
              <div className="pt-2">
                <Link
                  to={`/developers/${inspectEntry.userId}`}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <span>Open Full Developer Workbench</span>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
