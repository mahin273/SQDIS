import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, AlertTriangle, CheckCircle2, ShieldAlert, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { alertsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'
import type { Alert } from '@/types'

export function AlertsPage() {
  const queryClient = useQueryClient()
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')

  const alertsQuery = useQuery({
    queryKey: queryKeys.alerts.all({ severity: severityFilter !== 'ALL' ? severityFilter : undefined }),
    queryFn: () => alertsService.getAll({ severity: severityFilter !== 'ALL' ? (severityFilter as Alert['severity']) : undefined }),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      alertsService.resolve(id, notes || 'Resolved via alerts dashboard'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const alerts = alertsQuery.data?.data ?? []
  const activeAlerts = alerts.filter((a: Alert) => a.status !== 'RESOLVED').length
  const criticalAlerts = alerts.filter((a: Alert) => (a.severity === 'CRITICAL' || a.severity === 'HIGH') && a.status !== 'RESOLVED').length

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return <Badge variant="destructive">{severity}</Badge>
      case 'WARNING':
      case 'MEDIUM':
        return <Badge variant="secondary">{severity}</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  return (
    <div>
      <PageHeader
        title="Engineering System Alerts"
        description="Monitor automated quality drop alerts, test coverage regressions, and security vulnerability flags."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricTile label="Total Triggered Alerts" value={alerts.length} icon={<Bell className="h-5 w-5" />} />
        <MetricTile label="Active Unresolved Alerts" value={activeAlerts} icon={<AlertTriangle className="h-5 w-5" />} />
        <MetricTile label="Critical Priority Alerts" value={criticalAlerts} icon={<ShieldAlert className="h-5 w-5" />} />
      </div>

      <div className="mb-4 flex gap-2">
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
          <Button
            key={sev}
            variant={severityFilter === sev ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSeverityFilter(sev)}
          >
            {sev}
          </Button>
        ))}
      </div>

      <QueryState isLoading={alertsQuery.isLoading} error={alertsQuery.error} onRetry={() => alertsQuery.refetch()}>
        <Card>
          <CardHeader>
            <CardTitle>System Alerts Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.map((alert: Alert) => {
                const isResolved = alert.status === 'RESOLVED'

                return (
                  <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(alert.severity)}
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{alert.title || alert.type}</h3>
                        {isResolved && <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Resolved</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{alert.message}</p>
                      <p className="mt-1 text-xs text-slate-400">Triggered: {new Date(alert.createdAt).toLocaleString()}</p>
                    </div>

                    {!isResolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveMutation.mutate({ id: alert.id, notes: 'Resolved by user via alert management console' })}
                        isLoading={resolveMutation.isPending}
                        className="gap-1 shrink-0"
                      >
                        <Check className="h-3.5 w-3.5" /> Resolve
                      </Button>
                    )}
                  </div>
                )
              })}
              {alerts.length === 0 && (
                <EmptyState
                  title={severityFilter !== 'ALL' ? `No ${severityFilter.toLowerCase()} alerts` : "No active alerts"}
                  description={
                    severityFilter !== 'ALL'
                      ? `There are currently no ${severityFilter.toLowerCase()} priority alerts. Try selecting a different filter.`
                      : "All systems are operating normally. Quality drops, coverage regressions, or security flags will appear here."
                  }
                  icon={<CheckCircle2 className="h-7 w-7 text-emerald-500" />}
                  action={
                    severityFilter !== 'ALL' ? (
                      <Button variant="outline" size="sm" onClick={() => setSeverityFilter('ALL')}>
                        Show all alerts
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      </QueryState>
    </div>
  )
}
