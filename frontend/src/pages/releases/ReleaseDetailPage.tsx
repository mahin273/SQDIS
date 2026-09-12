import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Download,
  Calendar,
  Activity,
  AlertOctagon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { releasesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'
import { CanaryTelemetryRadarCard } from './components'
import type { ReleaseStatus } from '@/types'

export function ReleaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const releaseQuery = useQuery({
    queryKey: queryKeys.releases.detail(id ?? ''),
    queryFn: () => releasesService.getById(id!),
    enabled: !!id,
  })

  const readinessQuery = useQuery({
    queryKey: queryKeys.releases.readiness(id ?? ''),
    queryFn: () => releasesService.getReadiness(id!),
    enabled: !!id,
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: ReleaseStatus) =>
      releasesService.update(id!, {
        status,
        shippedAt: status === 'RELEASED' ? new Date().toISOString() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.all() })
    },
  })

  const release = releaseQuery.data
  const readiness = readinessQuery.data
  const currentStatus: ReleaseStatus = release?.isRolledBack
    ? 'ROLLED_BACK'
    : release?.shippedAt
    ? 'RELEASED'
    : release?.status || 'PLANNED'

  return (
    <div>
      <div className="mb-4">
        <Link to="/releases" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" /> Back to Releases
        </Link>
      </div>

      <QueryState isLoading={releaseQuery.isLoading} error={releaseQuery.error} onRetry={() => releaseQuery.refetch()}>
        {release && (
          <div>
            <PageHeader
              title={
                <div className="flex items-center gap-3">
                  <span>{release.version}</span>
                  {release.isRolledBack && (
                    <Badge variant="destructive" className="gap-1 text-xs py-1 px-2.5 font-bold">
                      <AlertOctagon className="h-3.5 w-3.5" /> ROLLED BACK
                    </Badge>
                  )}
                  {currentStatus === 'RELEASED' && (
                    <Badge variant="success" className="gap-1 text-xs py-1 px-2.5 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> SHIPPED
                    </Badge>
                  )}
                </div>
              }
              description={`Target deployment date: ${release.targetDate ? new Date(release.targetDate).toLocaleDateString() : 'TBD'}${
                release.isRolledBack && release.rolledBackAt
                  ? ` • Rolled back on ${new Date(release.rolledBackAt).toLocaleDateString()}`
                  : release.shippedAt
                  ? ` • Shipped on ${new Date(release.shippedAt).toLocaleDateString()}`
                  : ''
              }`}
              action={
                <div className="flex gap-2">
                  {!release.isRolledBack && currentStatus !== 'RELEASED' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate('RELEASED')}
                      isLoading={updateStatusMutation.isPending}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Rocket className="h-4 w-4" /> Ship Release
                    </Button>
                  )}
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Export Report
                  </Button>
                </div>
              }
            />

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <MetricTile
                label="Release Status"
                value={currentStatus.replace('_', ' ')}
                icon={
                  release.isRolledBack ? (
                    <AlertOctagon className="h-5 w-5 text-rose-500" />
                  ) : currentStatus === 'RELEASED' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-blue-500" />
                  )
                }
              />
              <MetricTile
                label="Readiness Score"
                value={`${Math.round(readiness?.score ?? release.readiness?.score ?? 0)}%`}
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <MetricTile label="Associated Sprints" value={release.sprints?.length ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} />
            </div>

            {/* Operational Telemetry & Canary Radar */}
            <div className="mb-6">
              <CanaryTelemetryRadarCard
                releaseId={release.id}
                releaseVersion={release.version}
                isRolledBack={release.isRolledBack}
                rolledBackAt={release.rolledBackAt}
                rollbackReason={release.rollbackReason}
                rollbackTriggeredBy={release.rollbackTriggeredBy}
                onRollbackSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(id!) });
                  queryClient.invalidateQueries({ queryKey: queryKeys.releases.readiness(id!) });
                }}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" /> Associated Sprints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {release.sprints?.map((sprint) => (
                      <div key={sprint.id} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{sprint.name}</p>
                            <p className="text-xs text-slate-500">
                              {sprint.team?.name || 'Team not assigned'} • {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="outline">{sprint.id.slice(0, 8)}</Badge>
                        </div>
                      </div>
                    ))}
                    {(!release.sprints || release.sprints.length === 0) && (
                      <p className="py-6 text-center text-sm text-slate-500">No sprints are linked to this release yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" /> Readiness Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {readiness ? (
                    <>
                      {readiness.isAtRisk && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 mb-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                          <span>Release is flagged At-Risk: Readiness score or telemetry regression is below tolerance.</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400">Bug Resolution Score</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.bugScore !== undefined ? `${Math.round(readiness.bugScore)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400">Test Coverage Score</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.coverageScore !== undefined ? `${Math.round(readiness.coverageScore)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400">Code Quality (DQS)</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.dqsScore !== undefined ? `${Math.round(readiness.dqsScore)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400">Test Suite Pass Rate</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.testPassRate !== undefined ? `${Math.round(readiness.testPassRate)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-indigo-500" /> Operational Telemetry Stability
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.telemetryScore !== undefined ? `${Math.round(readiness.telemetryScore)}%` : 'Not run'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span>Readiness metrics are not available yet.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  )
}
