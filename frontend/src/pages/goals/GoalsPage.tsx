import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Target, Plus, CheckCircle2, Clock, Award, Trash2, Edit3, ChevronDown, ChevronUp, AlertCircle, BarChart2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { goalsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'
import type { Goal, GoalStatus, GoalMetricType, GoalOperator } from '@/types'

export function GoalsPage() {
  const queryClient = useQueryClient()
  
  // State
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  
  // Create/Edit Goal Modal State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [metricType, setMetricType] = useState<GoalMetricType>('DQS')
  const [operator, setOperator] = useState<GoalOperator>('GTE')
  const [targetValue, setTargetValue] = useState<number>(100)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Queries
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.all(),
    queryFn: () => goalsService.getAll(),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => goalsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() })
      closeGoalModal()
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create goal'
      setFormError(Array.isArray(msg) ? msg.join(', ') : msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: any }) => goalsService.update(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() })
      closeGoalModal()
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
    },
  })

  // Data processing
  const allGoalsResponse = goalsQuery.data
  const allGoals = (allGoalsResponse?.data ?? []) as Goal[]
  
  const filteredGoals = useMemo(() => {
    if (filterStatus === 'ALL') return allGoals
    return allGoals.filter(g => g.status === filterStatus)
  }, [allGoals, filterStatus])

  const activeGoals = allGoals.filter((g) => g.status === 'ACTIVE').length
  const achievedGoals = allGoals.filter((g) => g.status === 'ACHIEVED').length

  // Handlers
  const openCreateModal = () => {
    setEditingGoalId(null)
    setTitle('')
    setDescription('')
    setMetricType('DQS')
    setOperator('GTE')
    setTargetValue(100)
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
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
    if (confirm('Are you sure you want to delete this goal?')) {
      deleteMutation.mutate(id)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedGoalId(expandedGoalId === id ? null : id)
  }

  // Helpers
  const getStatusBadge = (status: GoalStatus) => {
    switch (status) {
      case 'ACHIEVED':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Achieved</Badge>
      case 'AT_RISK':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> At Risk</Badge>
      case 'ACTIVE':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Active</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getMetricIcon = (type: GoalMetricType) => {
    switch (type) {
      case 'DQS': return <Award className="h-4 w-4" />
      case 'COVERAGE': return <CheckCircle2 className="h-4 w-4" />
      case 'BUG_COUNT': return <AlertCircle className="h-4 w-4" />
      default: return <BarChart2 className="h-4 w-4" />
    }
  }

  const getMetricColor = (type: GoalMetricType) => {
    switch (type) {
      case 'DQS': return 'bg-blue-500'
      case 'COVERAGE': return 'bg-emerald-500'
      case 'BUG_COUNT': return 'bg-rose-500'
      default: return 'bg-amber-500'
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering Goals & OKRs"
        description="Define quarterly engineering objectives, track key results, and monitor completion rates."
        action={
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="h-4 w-4" /> Create Goal
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile label="Total Goals" value={allGoals.length} icon={<Target className="h-5 w-5" />} />
        <MetricTile label="Active Goals" value={activeGoals} icon={<Clock className="h-5 w-5" />} />
        <MetricTile label="Achieved Goals" value={achievedGoals} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
        <MetricTile
          label="Achievement Rate"
          value={allGoals.length > 0 ? `${Math.round((achievedGoals / (allGoals.length - activeGoals || 1)) * 100)}%` : '0%'}
          helper="Of completed goals"
          icon={<Award className="h-5 w-5 text-amber-500" />}
        />
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <Tabs value={filterStatus} onValueChange={setFilterStatus}>
            <TabsList>
              <TabsTrigger value="ALL">All Goals</TabsTrigger>
              <TabsTrigger value="ACTIVE">Active</TabsTrigger>
              <TabsTrigger value="ACHIEVED">Achieved</TabsTrigger>
              <TabsTrigger value="AT_RISK">At Risk</TabsTrigger>
              <TabsTrigger value="MISSED">Missed</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent className="p-0">
          <QueryState isLoading={goalsQuery.isLoading} error={goalsQuery.error} onRetry={() => goalsQuery.refetch()}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredGoals.map((goal: Goal) => {
                const current = goal.currentValue ?? 0
                const target = goal.targetValue ?? 100
                const isInverse = goal.metricType === 'BUG_COUNT'
                
                // Calculate progress safely based on metric direction
                let progressPercent = 0
                if (isInverse) {
                  progressPercent = current <= target ? 100 : Math.max(0, 100 - ((current - target) / target * 100))
                } else {
                  progressPercent = Math.min(Math.round((current / target) * 100), 100)
                }

                const isExpanded = expandedGoalId === goal.id

                return (
                  <div key={goal.id} className="flex flex-col transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <div 
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                      onClick={() => toggleExpand(goal.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">{goal.name}</h3>
                          {getStatusBadge(goal.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 pl-7">
                          <span className="flex items-center gap-1">
                            {getMetricIcon(goal.metricType || 'DQS')}
                            <span className="font-medium text-slate-700 dark:text-slate-300">{goal.metricType}</span>
                          </span>
                          <span>•</span>
                          <span>Due: {goal.endDate ? new Date(goal.endDate).toLocaleDateString() : 'No end date'}</span>
                        </div>
                      </div>

                      <div className="w-full sm:w-64 pl-7 sm:pl-0 shrink-0 flex flex-col justify-center">
                        <div className="flex justify-between text-xs font-medium mb-1.5">
                          <span className="text-slate-500">Progress</span>
                          <span className="text-slate-900 dark:text-slate-100">
                            {current} / {target} <span className="text-slate-400 font-normal ml-1">({progressPercent}%)</span>
                          </span>
                        </div>
                        <Progress 
                          value={progressPercent} 
                          className="h-2" 
                          indicatorClassName={getMetricColor(goal.metricType || 'DQS')} 
                        />
                      </div>
                      
                      <div className="hidden sm:flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={(e) => openEditModal(goal, e)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600" onClick={(e) => handleDeleteGoal(goal.id, e)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-0 pl-12 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="mt-4 grid gap-6 md:grid-cols-2">
                          <div>
                            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Description</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                              {goal.description || 'No detailed description provided for this goal.'}
                            </p>
                            
                            <div className="mt-4 flex gap-4 text-sm">
                              <div>
                                <span className="text-slate-500 block mb-1">Start Date</span>
                                <span className="font-medium">{goal.startDate ? new Date(goal.startDate).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block mb-1">Created At</span>
                                <span className="font-medium">{goal.createdAt ? new Date(goal.createdAt).toLocaleDateString() : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Key Results / Tracking Metrics placeholder */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Tracking Metrics</h4>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                <Plus className="h-3 w-3" /> Add Metric
                              </Button>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium">Primary Target</span>
                                  <span className="text-xs font-mono">{current} / {target}</span>
                                </div>
                                <Progress value={progressPercent} className="h-1.5" />
                              </div>
                            </div>
                            
                            <div className="mt-4 sm:hidden flex items-center gap-2">
                              <Button variant="outline" size="sm" className="flex-1 text-slate-600" onClick={(e) => openEditModal(goal, e)}>
                                <Edit3 className="h-4 w-4 mr-2" /> Edit Goal
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1 text-rose-600 border-rose-200" onClick={(e) => handleDeleteGoal(goal.id, e)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              
              {filteredGoals.length === 0 && (
                <div className="py-12 text-center flex flex-col items-center">
                  <Target className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No Goals Found</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {filterStatus !== 'ALL' ? `No goals in ${filterStatus.toLowerCase()} status.` : 'You haven\'t created any engineering goals yet.'}
                  </p>
                  {filterStatus === 'ALL' && (
                    <Button onClick={openCreateModal} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" /> Create Your First Goal
                    </Button>
                  )}
                </div>
              )}
            </div>
          </QueryState>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal isOpen={isGoalModalOpen} onClose={closeGoalModal} title={editingGoalId ? "Edit Engineering Goal" : "Create Engineering Goal"}>
        <form onSubmit={handleSaveGoal} className="space-y-4">
          {formError && (
            <div className="p-3 text-sm text-rose-700 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{formError}</span>
            </div>
          )}

          <Input 
            label="Goal Name"
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="e.g. Increase Test Coverage to 85%" 
            required 
            autoFocus
          />
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Goal rationale or target details..." 
              className="flex w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Metric Type</label>
              <select
                value={metricType}
                onChange={(e) => {
                  const val = e.target.value as GoalMetricType
                  setMetricType(val)
                  setOperator(val === 'BUG_COUNT' ? 'LTE' : 'GTE')
                }}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="DQS">DQS (Developer Quality Score)</option>
                <option value="COVERAGE">Code Coverage %</option>
                <option value="BUG_COUNT">Bug Count (Lower is better)</option>
                <option value="COMMIT_COUNT">Commit Count</option>
                <option value="REVIEW_COUNT">Review Count</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Target Condition</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as GoalOperator)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="GTE">&gt;= At least (Target or higher)</option>
                <option value="LTE">&lt;= At most (Target or lower)</option>
                <option value="GT">&gt; Greater than</option>
                <option value="LT">&lt; Less than</option>
                <option value="EQ">= Equal to</option>
              </select>
            </div>
          </div>

          <Input 
            label="Target Value"
            type="number" 
            value={targetValue} 
            onChange={(e) => setTargetValue(Number(e.target.value))} 
            required 
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date"
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              required 
            />
            
            <Input 
              label="Target Date (Optional)"
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={closeGoalModal}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
              {editingGoalId ? "Save Changes" : "Create Goal"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
