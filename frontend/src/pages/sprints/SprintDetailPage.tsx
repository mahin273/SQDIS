import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, CheckCircle2, PlayCircle, Clock, 
  GitCommit, Users, FileText, AlertTriangle, Activity, LayoutDashboard,
  Download, ChevronDown, Zap
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dropdown, DropdownItem } from '@/components/ui/dropdown'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { sprintsService } from '@/services'
import { useAuthStore } from '@/stores/authStore'
import { useUserRole } from '@/rbac/hooks'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, QueryState } from '../pageUtils'
import type { SprintStatus, Commit } from '@/types'
import { CommitGroupBySprintCard } from '../releases/components/CommitGroupBySprintCard'
import { CommitDetailModal } from '../releases/components/CommitDetailModal'
import { SprintMetricsCard } from '../releases/components/SprintMetricsCard'
import { BurndownChart } from '@/components/charts/BurndownChart'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SprintDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null)
  const { toast } = useToast()

  const sprintQuery = useQuery({
    queryKey: queryKeys.sprints.detail(id ?? ''),
    queryFn: () => sprintsService.getById(id!),
    enabled: !!id,
  })

  const reportQuery = useQuery({
    queryKey: queryKeys.sprints.report(id ?? ''),
    queryFn: () => sprintsService.getReport(id!),
    enabled: !!id,
  })

  const burndownQuery = useQuery({
    queryKey: ['sprints', id, 'burndown'],
    queryFn: () => sprintsService.getBurndown(id!),
    enabled: !!id,
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: SprintStatus) => sprintsService.update(id!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.detail(id!) })
    },
  })

  const autoGenerateMutation = useMutation({
    mutationFn: () => sprintsService.autoGenerate(),
    onSuccess: (result) => {
      toast(result.message ?? `${result.count} sprint report(s) generated.`, { type: 'success' })
    },
    onError: () => {
      toast('Could not trigger report generation. Please try again.', { type: 'error' })
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: () => sprintsService.exportPdf(id!),
    onSuccess: (blob) => {
      downloadBlob(blob, `sprint-${id}-report.pdf`)
    },
    onError: () => {
      toast('Could not export PDF. Please try again.', { type: 'error' })
    },
  })

  const exportCsvMutation = useMutation({
    mutationFn: () => sprintsService.exportCsv(id!),
    onSuccess: (blob) => {
      downloadBlob(blob, `sprint-${id}-report.csv`)
    },
    onError: () => {
      toast('Could not export CSV. Please try again.', { type: 'error' })
    },
  })

  const sprint = sprintQuery.data
  const report = reportQuery.data

  const user = useAuthStore((state) => state.user)
  const userRole = useUserRole()
  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN'
  const isTeamLead = userRole === 'TEAM_LEAD'

  const canManageSprint = Boolean(
    isOwnerOrAdmin || (isTeamLead && user?.id && sprint?.team?.leadId === user.id)
  )

  const getStatusConfig = (status: SprintStatus) => {
    switch (status) {
      case 'COMPLETED':
        return { icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' }
      case 'ACTIVE':
        return { icon: <PlayCircle className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' }
      case 'CANCELLED':
        return { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400' }
      default:
        return { icon: <Clock className="h-4 w-4" />, color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300' }
    }
  }

  const getSprintProgress = () => {
    if (!sprint) return 0
    const today = new Date()
    const start = new Date(sprint.startDate)
    const end = new Date(sprint.endDate)
    
    if (today >= end) return 100
    if (today <= start) return 0
    
    const total = end.getTime() - start.getTime()
    const current = today.getTime() - start.getTime()
    return Math.min(100, Math.max(0, (current / total) * 100))
  }

  return (
    <div className="space-y-6">
      <div>
        <Link 
          to="/sprints" 
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 mb-4 transition-colors bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sprints
        </Link>
      </div>

      <QueryState isLoading={sprintQuery.isLoading} error={sprintQuery.error} onRetry={() => sprintQuery.refetch()}>
        {sprint && (
          <div className="space-y-6">
            <PageHeader
              title={sprint.name}
              description={`Iteration cycle running from ${new Date(sprint.startDate).toLocaleDateString()} to ${new Date(sprint.endDate).toLocaleDateString()}`}
              action={
                <div className="flex gap-3">
                  {canManageSprint && sprint.status === 'PLANNED' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate('ACTIVE')}
                      isLoading={updateStatusMutation.isPending}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      <PlayCircle className="h-4 w-4" /> Start Sprint
                    </Button>
                  )}
                  {canManageSprint && sprint.status === 'ACTIVE' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate('COMPLETED')}
                      isLoading={updateStatusMutation.isPending}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Complete Sprint
                    </Button>
                  )}
                  {isOwnerOrAdmin && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => autoGenerateMutation.mutate()}
                      isLoading={autoGenerateMutation.isPending}
                    >
                      <Zap className="h-4 w-4" /> Auto-Generate
                    </Button>
                  )}
                  <Dropdown
                    align="right"
                    trigger={
                      <Button
                        variant="outline"
                        className="gap-2"
                        isLoading={exportPdfMutation.isPending || exportCsvMutation.isPending}
                      >
                        <Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </Button>
                    }
                  >
                    <DropdownItem
                      icon={<FileText className="h-4 w-4" />}
                      onClick={() => exportPdfMutation.mutate()}
                      disabled={exportPdfMutation.isPending}
                    >
                      Download PDF
                    </DropdownItem>
                    <DropdownItem
                      icon={<Download className="h-4 w-4" />}
                      onClick={() => exportCsvMutation.mutate()}
                      disabled={exportCsvMutation.isPending}
                    >
                      Download CSV
                    </DropdownItem>
                  </Dropdown>
                  {canManageSprint && (
                    <Button variant="outline" className="gap-2">
                      <FileText className="h-4 w-4" /> Edit Details
                    </Button>
                  )}
                </div>
              }
            />

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-4 bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
                <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">
                  <LayoutDashboard className="h-4 w-4" /> Overview
                </TabsTrigger>
                <TabsTrigger value="commits" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">
                  <GitCommit className="h-4 w-4" /> Commits ({sprint.commits?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-0">
                <SprintMetricsCard sprint={sprint} report={report} />

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Burndown Chart */}
                  <Card className="border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                    <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-indigo-500" />
                          Sprint Burndown
                        </div>
                        {burndownQuery.data?.isOnTrack !== undefined && (
                          <Badge
                            variant={burndownQuery.data.isOnTrack ? 'success' : 'destructive'}
                            className="text-xs"
                          >
                            {burndownQuery.data.isOnTrack ? 'On Track' : 'Behind Schedule'}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 flex-grow flex flex-col justify-between">
                      {burndownQuery.isLoading ? (
                        <div className="h-56 flex items-center justify-center text-sm text-slate-500">
                          Loading burndown metrics...
                        </div>
                      ) : (
                        <>
                          <BurndownChart data={burndownQuery.data} height={220} />
                          {burndownQuery.data && (
                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                              <div>
                                <span className="text-slate-400 block">Total Scope</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {burndownQuery.data.totalWork ?? 0} commits
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Completed</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {burndownQuery.data.completedWork ?? 0}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Remaining</span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                  {burndownQuery.data.remainingWork ?? 0}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Sprint Details Panel */}
                  <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-5 w-5 text-emerald-500" /> 
                        Sprint Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        <div className="p-4 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-500">Status</span>
                          <Badge variant="outline" className={`gap-1.5 px-2 ${getStatusConfig(sprint.status).color}`}>
                            {getStatusConfig(sprint.status).icon}
                            {sprint.status}
                          </Badge>
                        </div>
                        
                        <div className="p-4 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-500">Team</span>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sprint.team?.name || 'Unassigned'}</span>
                          </div>
                        </div>

                        <div className="p-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-500">Time Elapsed</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{Math.round(getSprintProgress())}%</span>
                          </div>
                          <Progress value={getSprintProgress()} className="h-2" />
                          <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>{new Date(sprint.startDate).toLocaleDateString()}</span>
                            <span>{new Date(sprint.endDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <div className="p-4 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-500">Total Commits</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sprint.commits?.length || 0}</span>
                        </div>
                        
                        <div className="p-4 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-500">Committed Points</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sprint.committedPoints || 'N/A'}</span>
                        </div>
                        
                        <div className="p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-900/30">
                          <span className="text-sm font-medium text-slate-500">Completed Points</span>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{sprint.completedPoints || 'N/A'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="commits" className="mt-0">
                <CommitGroupBySprintCard 
                  sprintName={sprint.name} 
                  commits={sprint.commits || []} 
                  onSelectCommit={setSelectedCommit}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </QueryState>

      {/* Reused Commit Detail Modal */}
      <CommitDetailModal commit={selectedCommit} onClose={() => setSelectedCommit(null)} />
    </div>
  )
}
