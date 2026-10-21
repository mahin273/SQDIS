import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Target,
  Plus,
  CheckCircle2,
  Clock,
  Award,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  BarChart2,
  RefreshCw,
  Sparkles,
  BookOpen,
  TrendingUp,
  Sliders,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/toast'
import { goalsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { QueryState } from '../pageUtils'
import type {
  Goal,
  GoalStatus,
  GoalMetricType,
  GoalOperator,
  KeyResult,
  GoalTemplate,
  GoalAchievement,
} from '@/types'

export function GoalsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<'objectives' | 'templates' | 'achievements'>('objectives')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [metricFilter, setMetricFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)

  // Create/Edit Goal Modal State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [metricType, setMetricType] = useState<GoalMetricType>('DQS')
  const [operator, setOperator] = useState<GoalOperator>('GTE')
  const [targetValue, setTargetValue] = useState<number>(85)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Key Result Modal State
  const [isKRModalOpen, setIsKRModalOpen] = useState(false)
  const [krGoalId, setKrGoalId] = useState<string | null>(null)
  const [krDescription, setKrDescription] = useState('')
  const [krTargetValue, setKrTargetValue] = useState<number>(100)
  const [krCurrentValue, setKrCurrentValue] = useState<number>(0)
  const [krWeight, setKrWeight] = useState<number>(1.0)

  // Update Key Result Value Quick Modal
  const [isUpdateKRValueOpen, setIsUpdateKRValueOpen] = useState(false)
  const [activeKR, setActiveKR] = useState<{ goalId: string; kr: KeyResult } | null>(null)
  const [newKRValue, setNewKRValue] = useState<number>(0)

  // Queries
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.all({
      status: filterStatus !== 'ALL' ? (filterStatus as GoalStatus) : undefined,
      metricType: metricFilter !== 'ALL' ? (metricFilter as GoalMetricType) : undefined,
    }),
    queryFn: () =>
      goalsService.getAll({
        status: filterStatus !== 'ALL' ? (filterStatus as GoalStatus) : undefined,
        metricType: metricFilter !== 'ALL' ? (metricFilter as GoalMetricType) : undefined,
      }),
  })

  const templatesQuery = useQuery({
    queryKey: ['goals', 'templates'],
    queryFn: () => goalsService.getTemplates(),
  })

  const achievementsQuery = useQuery({
    queryKey: ['goals', 'achievements'],
    queryFn: () => goalsService.getAchievements(),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => goalsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() })
      closeGoalModal()
      toast('Objective Created', {
        type: 'success',
        description: 'New engineering goal scheduled successfully.',
      })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create goal'
      setFormError(Array.isArray(msg) ? msg.join(', ') : msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) => goalsService.update(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() })
      closeGoalModal()
      toast('Objective Updated', {
        type: 'success',
        description: 'Engineering goal details updated successfully.',
      })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update goal'
      setFormError(Array.isArray(msg) ? msg.join(', ') : msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() })
      toast('Objective Removed', {
        type: 'info',
        description: 'Goal was successfully deleted.',
      })
    },
  })

  const addKeyResultMutation = useMutation({
    mutationFn: (data: { goalId: string; payload: any }) =>
      goalsService.addKeyResult(data.goalId, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() })
      setIsKRModalOpen(false)
      setKrDescription('')
      setKrTargetValue(100)
      setKrCurrentValue(0)
      setKrWeight(1.0)
      toast('Key Result Added', {
        type: 'success',
        description: 'Measurable milestone added to objective.',
      })
    },
    onError: (err: any) => {
      toast('Failed to Add Key Result', {
        type: 'error',
        description: err?.response?.data?.message || 'Could not create key result.',
      })
    },
  })

  const updateKeyResultMutation = useMutation({
    mutationFn: (data: { goalId: string; keyResultId: string; payload: any }) =>
      goalsService.updateKeyResult(data.goalId, data.keyResultId, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() })
      setIsUpdateKRValueOpen(false)
      setActiveKR(null)
      toast('Key Result Updated', {
        type: 'success',
        description: 'Progress milestone updated successfully.',
      })
    },
    onError: (err: any) => {
      toast('Update Failed', {
        type: 'error',
        description: err?.response?.data?.message || 'Could not update key result.',
      })
    },
  })

  // Data Normalization
  const allGoalsResponse = goalsQuery.data
  const allGoals = useMemo(() => {
    const list: Goal[] = (allGoalsResponse?.data ?? []) as Goal[]
    return list
  }, [allGoalsResponse])

  const templates: GoalTemplate[] = useMemo(() => {
    return Array.isArray(templatesQuery.data) ? templatesQuery.data : []
  }, [templatesQuery.data])

  const achievements: GoalAchievement[] = useMemo(() => {
    return Array.isArray(achievementsQuery.data) ? achievementsQuery.data : []
  }, [achievementsQuery.data])

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    let result = allGoals
    if (filterStatus !== 'ALL') {
      result = result.filter((g) => g.status === filterStatus)
    }
    if (metricFilter !== 'ALL') {
      result = result.filter((g) => g.metricType === metricFilter)
    }
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase().trim()
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(lower) ||
          g.description?.toLowerCase().includes(lower) ||
          g.owner?.name?.toLowerCase().includes(lower) ||
          g.metricType?.toLowerCase().includes(lower)
      )
    }
    return result
  }, [allGoals, filterStatus, metricFilter, searchQuery])

  // Executive Metric Calculations
  const activeGoalsCount = allGoals.filter((g) => g.status === 'ACTIVE').length
  const achievedGoalsCount = allGoals.filter((g) => g.status === 'ACHIEVED').length
  const atRiskGoalsCount = allGoals.filter((g) => {
    const isAtRisk = (g as any).isAtRisk || g.status === 'AT_RISK' || (g.progress && !g.progress.isOnTrack)
    return isAtRisk && g.status !== 'ACHIEVED'
  }).length

  const totalKeyResultsCount = useMemo(() => {
    return allGoals.reduce((sum, g) => sum + (g.keyResults?.length || 0), 0)
  }, [allGoals])

  const overallProgressPercentage = useMemo(() => {
    if (allGoals.length === 0) return 0
    const percentages = allGoals.map((g) => {
      const current = g.currentValue ?? 0
      const target = g.targetValue ?? 100
      const isInverse = g.metricType === 'BUG_COUNT'
      if (isInverse) {
        return current <= target ? 100 : Math.max(0, 100 - ((current - target) / (target || 1)) * 100)
      }
      return target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
    })
    return Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
  }, [allGoals])

  // Handlers
  const openCreateModal = () => {
    setEditingGoalId(null)
    setTitle('')
    setDescription('')
    setMetricType('DQS')
    setOperator('GTE')
    setTargetValue(88)
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    const end = new Date()
    end.setDate(end.getDate() + 90)
    setEndDate(end.toISOString().split('T')[0])
    setFormError(null)
    setIsGoalModalOpen(true)
  }

  const openEditModal = (goal: Goal, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingGoalId(goal.id)
    setTitle(goal.name)
    setDescription(goal.description || '')
    setMetricType(goal.metricType || 'DQS')
    setOperator(goal.operator || (goal.metricType === 'BUG_COUNT' ? 'LTE' : 'GTE'))
    setTargetValue(goal.targetValue || 100)
    setStartDate(goal.startDate ? new Date(goal.startDate).toISOString().split('T')[0] : '')
    setEndDate(goal.endDate ? new Date(goal.endDate).toISOString().split('T')[0] : '')
    setFormError(null)
    setIsGoalModalOpen(true)
  }

  const handleUseTemplate = (tpl: GoalTemplate) => {
    setEditingGoalId(null)
    setTitle(tpl.name)
    setDescription(`Standard organization objective based on template: ${tpl.name}`)
    setMetricType((tpl.metricType as GoalMetricType) || 'DQS')
    setOperator((tpl.operator as GoalOperator) || (tpl.metricType === 'BUG_COUNT' ? 'LTE' : 'GTE'))
    setTargetValue(tpl.targetValue || 100)
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    const end = new Date()
    end.setDate(end.getDate() + (tpl.durationDays || 90))
    setEndDate(end.toISOString().split('T')[0])
    setFormError(null)
    setIsGoalModalOpen(true)
  }

  const closeGoalModal = () => {
    setIsGoalModalOpen(false)
    setEditingGoalId(null)
    setFormError(null)
  }

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!title.trim() || !startDate) {
      setFormError('Goal name and start date are required.')
      return
    }

    const effectiveOperator = operator || (metricType === 'BUG_COUNT' ? 'LTE' : 'GTE')
    const payload = {
      name: title.trim(),
      description: description.trim() || undefined,
      metricType,
      operator: effectiveOperator,
      targetValue: Number(targetValue),
      startDate,
      endDate: endDate || undefined,
    }

    if (editingGoalId) {
      updateMutation.mutate({ id: editingGoalId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDeleteGoal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this objective?')) {
      deleteMutation.mutate(id)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedGoalId(expandedGoalId === id ? null : id)
  }

  const handleRefresh = () => {
    goalsQuery.refetch()
    templatesQuery.refetch()
    achievementsQuery.refetch()
  }

  // Helpers
  const getStatusBadge = (status: GoalStatus | string, isAtRisk?: boolean) => {
    if (isAtRisk && status !== 'ACHIEVED') {
      return (
        <Badge className="gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-semibold">
          <AlertCircle className="h-3 w-3" /> At Risk
        </Badge>
      )
    }

    switch (status) {
      case 'ACHIEVED':
        return (
          <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
            <CheckCircle2 className="h-3 w-3" /> Achieved
          </Badge>
        )
      case 'AT_RISK':
        return (
          <Badge className="gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-semibold">
            <AlertCircle className="h-3 w-3" /> At Risk
          </Badge>
        )
      case 'ACTIVE':
        return (
          <Badge className="gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> Active
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[11px]">
            {status}
          </Badge>
        )
    }
  }

  const getMetricBadge = (type: GoalMetricType | string) => {
    switch (type) {
      case 'DQS':
        return (
          <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px] font-mono">
            <Award className="h-3 w-3" /> DQS Benchmark
          </Badge>
        )
      case 'COVERAGE':
        return (
          <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-mono">
            <CheckCircle2 className="h-3 w-3" /> Code Coverage
          </Badge>
        )
      case 'BUG_COUNT':
        return (
          <Badge variant="outline" className="gap-1 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800 text-[10px] font-mono">
            <AlertCircle className="h-3 w-3" /> Bug Containment
          </Badge>
        )
      case 'COMMIT_COUNT':
        return (
          <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[10px] font-mono">
            <TrendingUp className="h-3 w-3" /> Feature Commits
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1 text-[10px] font-mono">
            <BarChart2 className="h-3 w-3" /> {type}
          </Badge>
        )
    }
  }

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Sleek Minimalist Top Toolbar (No Bulky Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Engineering Goals & OKRs
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                  OKR Tracker Active
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Define quarterly engineering objectives, track measurable key results, and monitor organization delivery commitments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Metric Filter Dropdown */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <Sliders className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <select
              value={metricFilter}
              onChange={(e) => setMetricFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                All Metrics
              </option>
              <option value="DQS" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                DQS Benchmarks
              </option>
              <option value="COVERAGE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Code Coverage
              </option>
              <option value="BUG_COUNT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Bug Containment
              </option>
              <option value="COMMIT_COUNT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Feature Commits
              </option>
            </select>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={goalsQuery.isFetching}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${goalsQuery.isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {/* Create Objective Button */}
          <Button
            size="sm"
            onClick={openCreateModal}
            className="rounded-xl text-xs gap-1.5 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Objective</span>
          </Button>
        </div>
      </div>

      {/* 4-Card Executive KPI Strip */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Objectives */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Active Objectives
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {activeGoalsCount}
                </span>
                <span className="text-xs text-slate-500">active</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Q4 Engineering Cadence
              </p>
            </div>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-3 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Overall OKR Completion Rate */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                OKR Progress Rate
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {overallProgressPercentage}%
                </span>
                <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  On Pace
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Target benchmark: 80%
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Key Results Tracked */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Key Results
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {totalKeyResultsCount}
                </span>
                <span className="text-xs text-slate-500">milestones</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Weighted milestone tracking
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Objectives At Risk */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                At Risk Objectives
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {atRiskGoalsCount}
                </span>
                <span
                  className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    atRiskGoalsCount > 0
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {atRiskGoalsCount > 0 ? 'Action Needed' : 'All On Track'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {achievedGoalsCount} objective(s) achieved
              </p>
            </div>
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'objectives' | 'templates' | 'achievements')}
        className="w-full space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <TabsTrigger
              value="objectives"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              Objectives & Key Results
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-slate-200 dark:bg-slate-700">
                {allGoals.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              OKR Templates Library
              {templates.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {templates.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="achievements"
              className="text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-xs"
            >
              Achievements Log
              {achievedGoalsCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {achievedGoalsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Automated Telemetry Sync Enabled
            </span>
          </div>
        </div>

        {/* TAB 1: OBJECTIVES & KEY RESULTS (OKR STUDIO) */}
        {activeTab === 'objectives' && (
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Search Input */}
                  <div className="w-full sm:w-80">
                    <Input
                      placeholder="Search objectives, metrics, owners..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                  </div>

                  {/* Status Filter Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {(['ALL', 'ACTIVE', 'ACHIEVED', 'AT_RISK'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          filterStatus === status
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {status === 'ALL'
                          ? `All (${allGoals.length})`
                          : status === 'ACTIVE'
                          ? `Active (${activeGoalsCount})`
                          : status === 'ACHIEVED'
                          ? `Achieved (${achievedGoalsCount})`
                          : `At Risk (${atRiskGoalsCount})`}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OKR Cards List */}
            <QueryState
              isLoading={goalsQuery.isLoading}
              error={goalsQuery.error}
              onRetry={() => goalsQuery.refetch()}
            >
              <div className="space-y-4">
                {filteredGoals.map((goal: Goal) => {
                  const current = goal.currentValue ?? 0
                  const target = goal.targetValue ?? 100
                  const isInverse = goal.metricType === 'BUG_COUNT'
                  const isAtRisk =
                    (goal as any).isAtRisk ||
                    goal.status === 'AT_RISK' ||
                    (goal.progress && !goal.progress.isOnTrack)

                  let progressPercent = 0
                  if (isInverse) {
                    progressPercent =
                      current <= target
                        ? 100
                        : Math.max(0, 100 - ((current - target) / (target || 1)) * 100)
                  } else {
                    progressPercent =
                      target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
                  }

                  const isExpanded = expandedGoalId === goal.id
                  const keyResults = goal.keyResults || []

                  return (
                    <Card
                      key={goal.id}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all overflow-hidden group"
                    >
                      <div
                        className="p-5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                        onClick={() => toggleExpand(goal.id)}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left Column: Title & Metadata */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {getMetricBadge(goal.metricType || 'DQS')}
                              {getStatusBadge(goal.status, isAtRisk)}
                              <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                Condition: {goal.operator} {target}
                              </span>
                            </div>

                            <div className="flex items-start gap-2">
                              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                {goal.name}
                              </h3>
                            </div>

                            {goal.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                {goal.description}
                              </p>
                            )}

                            {/* Metadata Row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                              {goal.owner && (
                                <div className="flex items-center gap-1.5">
                                  <Avatar
                                    src={goal.owner.avatarUrl}
                                    name={goal.owner.name}
                                    size="sm"
                                    className="h-4 w-4 text-[9px]"
                                  />
                                  <span>{goal.owner.name}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-1 font-mono">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span>
                                  Due:{' '}
                                  {goal.endDate
                                    ? new Date(goal.endDate).toLocaleDateString()
                                    : 'Ongoing'}
                                </span>
                              </div>

                              {keyResults.length > 0 && (
                                <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>{keyResults.length} Key Results</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Column: Progress & Actions */}
                          <div className="w-full lg:w-72 shrink-0 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium">Objective Progress</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                                {current} / {target}{' '}
                                <span className="text-indigo-600 dark:text-indigo-400 ml-1">
                                  ({progressPercent}%)
                                </span>
                              </span>
                            </div>

                            <Progress
                              value={progressPercent}
                              className="h-2"
                              indicatorClassName={
                                progressPercent >= 80
                                  ? 'bg-emerald-500'
                                  : progressPercent >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }
                            />

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3.5 w-3.5" />
                                    <span>Hide Key Results</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3.5 w-3.5" />
                                    <span>View Key Results ({keyResults.length})</span>
                                  </>
                                )}
                              </span>

                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-slate-500 hover:text-indigo-600"
                                  onClick={(e) => openEditModal(goal, e)}
                                  title="Edit Objective"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-slate-500 hover:text-rose-600"
                                  onClick={(e) => handleDeleteGoal(goal.id, e)}
                                  title="Delete Objective"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Key Results Section */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Measurable Key Results
                              </h4>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 bg-white dark:bg-slate-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                setKrGoalId(goal.id)
                                setIsKRModalOpen(true)
                              }}
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add Key Result</span>
                            </Button>
                          </div>

                          <div className="space-y-2.5">
                            {keyResults.map((kr: KeyResult) => {
                              const krProgress =
                                kr.targetValue > 0
                                  ? Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100))
                                  : 0

                              return (
                                <div
                                  key={kr.id}
                                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        {kr.description || kr.title}
                                      </p>
                                      {kr.weight && kr.weight !== 1.0 && (
                                        <Badge variant="secondary" className="text-[10px] h-4 font-mono">
                                          {kr.weight}x weight
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                                      <span>
                                        Progress: {kr.currentValue} / {kr.targetValue} ({krProgress}%)
                                      </span>
                                    </div>
                                  </div>

                                  <div className="w-full sm:w-44 flex items-center gap-3">
                                    <Progress value={krProgress} className="h-1.5 flex-1" />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-[11px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setActiveKR({ goalId: goal.id, kr })
                                        setNewKRValue(kr.currentValue)
                                        setIsUpdateKRValueOpen(true)
                                      }}
                                    >
                                      Update
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}

                            {keyResults.length === 0 && (
                              <div className="py-6 text-center text-xs text-slate-500">
                                No key results added yet. Define key results to measure tangible progress.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}

                {filteredGoals.length === 0 && (
                  <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-12 text-center">
                    <Target className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      No Objectives Found
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                      {searchQuery
                        ? `No engineering objectives matching "${searchQuery}". Try adjusting your filters.`
                        : 'Define your first engineering objective to align your team around critical quality benchmarks.'}
                    </p>
                    <Button
                      size="sm"
                      onClick={openCreateModal}
                      className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create First Objective</span>
                    </Button>
                  </Card>
                )}
              </div>
            </QueryState>
          </div>
        )}

        {/* TAB 2: OKR TEMPLATES LIBRARY */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Pre-Built Engineering Goal Templates</CardTitle>
                      <CardDescription className="text-xs">
                        Industry-standard OKR templates ready for immediate team adoption
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {templates.length} templates available
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          {getMetricBadge(tpl.metricType || 'DQS')}
                          <span className="text-[11px] font-mono text-slate-400">
                            {tpl.durationDays} days
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {tpl.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono">
                          Target: {tpl.operator} {tpl.targetValue}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUseTemplate(tpl)}
                        className="w-full text-xs gap-1.5 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Use This Template</span>
                      </Button>
                    </div>
                  ))}

                  {templates.length === 0 && (
                    <div className="col-span-full py-12 text-center text-xs text-slate-500">
                      No goal templates found.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: ACHIEVEMENTS LOG */}
        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <Award className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Engineering Milestone Achievements</CardTitle>
                      <CardDescription className="text-xs">
                        Verified objectives fulfilled and retired by engineering teams
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {achievedGoalsCount + achievements.length} achieved
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allGoals
                    .filter((g) => g.status === 'ACHIEVED')
                    .map((goal) => (
                      <div
                        key={goal.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                              {goal.name}
                            </h4>
                            {getMetricBadge(goal.metricType || 'DQS')}
                          </div>
                          <p className="text-xs text-slate-500 pl-6">
                            Target: {goal.operator} {goal.targetValue} · Reached {goal.currentValue}
                          </p>
                        </div>

                        <div className="text-right text-xs text-slate-500 font-mono">
                          <span>
                            Achieved on{' '}
                            {goal.achievedAt
                              ? new Date(goal.achievedAt).toLocaleDateString()
                              : new Date().toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}

                  {achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {ach.goalTitle}
                          </h4>
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                            ACHIEVED
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-500 font-mono">
                        <span>
                          Achieved on {new Date(ach.achievedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}

                  {achievedGoalsCount === 0 && achievements.length === 0 && (
                    <div className="py-12 text-center text-xs text-slate-500">
                      No completed objectives in archive yet. Fulfill active goals to populate the achievement log.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>

      {/* Create / Edit Goal Modal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={closeGoalModal}
        title={editingGoalId ? 'Edit Engineering Objective' : 'Define Engineering Objective (OKR)'}
      >
        <form onSubmit={handleSaveGoal} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Objective Title <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Elevate Core Architecture DQS Benchmark Above 88"
              required
              autoFocus
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Objective Rationale & Scope
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why does this objective matter for technical excellence?..."
              className="w-full min-h-[80px] rounded-lg border border-slate-200 bg-white p-2.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Metric Type
              </label>
              <select
                value={metricType}
                onChange={(e) => {
                  const val = e.target.value as GoalMetricType
                  setMetricType(val)
                  setOperator(val === 'BUG_COUNT' ? 'LTE' : 'GTE')
                }}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="DQS">DQS (Developer Quality Score)</option>
                <option value="COVERAGE">Code Coverage %</option>
                <option value="BUG_COUNT">Bug Count (Lower is better)</option>
                <option value="COMMIT_COUNT">Feature Commits</option>
                <option value="REVIEW_COUNT">Review Turnarounds</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Condition Operator
              </label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as GoalOperator)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="GTE">&gt;= At least (Target or higher)</option>
                <option value="LTE">&lt;= At most (Target or lower)</option>
                <option value="GT">&gt; Strictly greater than</option>
                <option value="LT">&lt; Strictly less than</option>
                <option value="EQ">= Exact Target</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Value <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              step="any"
              value={targetValue}
              onChange={(e) => setTargetValue(Number(e.target.value))}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Due Date
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + 90)
                    setEndDate(d.toISOString().split('T')[0])
                  }}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Set 90 Days
                </button>
              </div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={closeGoalModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={createMutation.isPending || updateMutation.isPending}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{editingGoalId ? 'Save Changes' : 'Create Objective'}</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Key Result Modal */}
      <Modal
        isOpen={isKRModalOpen}
        onClose={() => setIsKRModalOpen(false)}
        title="Add Measurable Key Result"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!krGoalId || !krDescription.trim()) return
            addKeyResultMutation.mutate({
              goalId: krGoalId,
              payload: {
                description: krDescription.trim(),
                targetValue: Number(krTargetValue),
                currentValue: Number(krCurrentValue),
                weight: Number(krWeight),
              },
            })
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Key Result Statement <span className="text-rose-500">*</span>
            </label>
            <Input
              value={krDescription}
              onChange={(e) => setKrDescription(e.target.value)}
              placeholder="e.g. Ingest 120+ modules into CI coverage pipeline"
              required
              autoFocus
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Value
              </label>
              <Input
                type="number"
                step="any"
                value={krTargetValue}
                onChange={(e) => setKrTargetValue(Number(e.target.value))}
                required
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Initial Progress Value
              </label>
              <Input
                type="number"
                step="any"
                value={krCurrentValue}
                onChange={(e) => setKrCurrentValue(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Milestone Weight Multiplier
            </label>
            <Input
              type="number"
              step="0.1"
              value={krWeight}
              onChange={(e) => setKrWeight(Number(e.target.value))}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsKRModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={addKeyResultMutation.isPending}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Key Result</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Update Key Result Value Modal */}
      <Modal
        isOpen={isUpdateKRValueOpen}
        onClose={() => setIsUpdateKRValueOpen(false)}
        title="Update Milestone Progress"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!activeKR) return
            updateKeyResultMutation.mutate({
              goalId: activeKR.goalId,
              keyResultId: activeKR.kr.id,
              payload: {
                currentValue: Number(newKRValue),
              },
            })
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
              Milestone:{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeKR?.kr.description || activeKR?.kr.title}
              </span>
            </p>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Current Value (Target: {activeKR?.kr.targetValue})
            </label>
            <Input
              type="number"
              step="any"
              value={newKRValue}
              onChange={(e) => setNewKRValue(Number(e.target.value))}
              required
              autoFocus
              className="h-9 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsUpdateKRValueOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={updateKeyResultMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Save Progress
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
