import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Gauge,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Clock,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { releasesService } from '@/services';
import type { ReleaseTelemetryAnalysis } from '@/types';

interface CanaryTelemetryRadarCardProps {
  releaseId: string;
  releaseVersion: string;
}

export const CanaryTelemetryRadarCard: React.FC<CanaryTelemetryRadarCardProps> = ({
  releaseId,
  releaseVersion,
}) => {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

  const historyQuery = useQuery({
    queryKey: ['releases', releaseId, 'telemetry'],
    queryFn: () => releasesService.getCanaryTelemetry(releaseId),
    enabled: !!releaseId,
  });

  const evaluateMutation = useMutation({
    mutationFn: () => releasesService.evaluateCanaryTelemetry(releaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases', releaseId, 'telemetry'] });
      queryClient.invalidateQueries({ queryKey: ['releases', releaseId, 'readiness'] });
      queryClient.invalidateQueries({ queryKey: ['releases', releaseId] });
    },
  });

  const history = historyQuery.data || [];
  const latest: ReleaseTelemetryAnalysis | undefined = history[0];

  const getVerdictBadge = (verdict?: string) => {
    switch (verdict) {
      case 'HEALTHY':
        return (
          <Badge variant="success" className="gap-1.5 py-1 px-2.5 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
          </Badge>
        );
      case 'DEGRADED':
        return (
          <Badge variant="warning" className="gap-1.5 py-1 px-2.5 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> Degraded
          </Badge>
        );
      case 'CRITICAL_REGRESSION':
        return (
          <Badge variant="destructive" className="gap-1.5 py-1 px-2.5 text-xs font-semibold">
            <AlertOctagon className="h-3.5 w-3.5" /> Critical Regression
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-semibold text-slate-500">
            <Clock className="h-3.5 w-3.5" /> Not Evaluated
          </Badge>
        );
    }
  };

  const getRecommendationBanner = (rec?: string) => {
    if (!rec) return null;
    if (rec === 'TRIGGER_ROLLBACK') {
      return (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertOctagon className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div>
            <p className="font-semibold">Rollback Recommended</p>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              Canary telemetry observed significant performance regression or memory growth exceeding safe limits.
            </p>
          </div>
        </div>
      );
    }
    if (rec === 'MONITOR_CLOSELY') {
      return (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold">Monitor Closely</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Slight latency increase or error variance detected. Observe before scaling to full traffic.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3.5 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
        <div>
          <p className="font-semibold">Proceed with Rollout</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            Operational telemetry verified. Response latency, error rates, and memory consumption match safe baselines.
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Operational Telemetry & Canary Radar
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live container latency, error rates, and memory shifts for {releaseVersion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs h-8"
            >
              {showHistory ? 'Hide History' : `History (${history.length})`}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => evaluateMutation.mutate()}
            isLoading={evaluateMutation.isPending}
            className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${evaluateMutation.isPending ? 'animate-spin' : ''}`} />
            Run Telemetry Check
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {!latest ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center">
            <Server className="h-10 w-10 text-slate-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Telemetry Checks Recorded</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Click &quot;Run Telemetry Check&quot; to correlate this release with live production metrics (P95 latency, 5xx errors, and memory footprint).
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {getVerdictBadge(latest.verdict)}
                <span className="text-xs text-slate-500">
                  Evaluated on {new Date(latest.createdAt).toLocaleTimeString()} ({new Date(latest.createdAt).toLocaleDateString()})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Stability Score:</span>
                <span
                  className={`text-sm font-bold ${
                    latest.score >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : latest.score >= 60
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {Math.round(latest.score)} / 100
                </span>
              </div>
            </div>

            {getRecommendationBanner(latest.recommendation)}

            {/* Core Telemetry Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* P95 Latency */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="font-medium flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500" /> P95 Response Latency
                  </span>
                  <span
                    className={`font-semibold ${
                      latest.deltas.latency_delta_pct <= 5
                        ? 'text-emerald-600'
                        : latest.deltas.latency_delta_pct <= 15
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {latest.deltas.latency_delta_pct > 0 ? '+' : ''}
                    {latest.deltas.latency_delta_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {latest.canaryMetrics?.p95_latency_ms?.toFixed(1) ?? '—'} <span className="text-xs font-normal text-slate-500">ms</span>
                    </p>
                    <p className="text-[11px] text-slate-400">Observed Canary</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {latest.baselineMetrics?.p95_latency_ms?.toFixed(1) ?? '—'} ms
                    </p>
                    <p className="text-[11px] text-slate-400">Baseline</p>
                  </div>
                </div>
              </div>

              {/* 5xx Error Rate */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="font-medium flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5 text-rose-500" /> 5xx HTTP Error Rate
                  </span>
                  <span
                    className={`font-semibold ${
                      latest.deltas.error_rate_delta <= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {latest.deltas.error_rate_delta > 0 ? '+' : ''}
                    {latest.deltas.error_rate_delta.toFixed(3)}/s
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {latest.canaryMetrics?.error_rate_5xx?.toFixed(3) ?? '0.000'}{' '}
                      <span className="text-xs font-normal text-slate-500">req/s</span>
                    </p>
                    <p className="text-[11px] text-slate-400">Observed Canary</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {latest.baselineMetrics?.error_rate_5xx?.toFixed(3) ?? '0.000'} req/s
                    </p>
                    <p className="text-[11px] text-slate-400">Baseline</p>
                  </div>
                </div>
              </div>

              {/* Memory Footprint RSS */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="font-medium flex items-center gap-1">
                    <Server className="h-3.5 w-3.5 text-blue-500" /> Memory Footprint (RSS)
                  </span>
                  <span
                    className={`font-semibold ${
                      latest.deltas.memory_delta_pct <= 5
                        ? 'text-emerald-600'
                        : latest.deltas.memory_delta_pct <= 15
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {latest.deltas.memory_delta_pct > 0 ? '+' : ''}
                    {latest.deltas.memory_delta_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {latest.canaryMetrics?.memory_rss_mb?.toFixed(1) ?? '—'}{' '}
                      <span className="text-xs font-normal text-slate-500">MB</span>
                    </p>
                    <p className="text-[11px] text-slate-400">Observed Canary</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {latest.baselineMetrics?.memory_rss_mb?.toFixed(1) ?? '—'} MB
                    </p>
                    <p className="text-[11px] text-slate-400">Baseline</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Violations */}
            {latest.violations && latest.violations.length > 0 && (
              <div className="space-y-2 pt-1">
                <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-rose-500" /> Operational Rule Breaches ({latest.violations.length})
                </h5>
                <div className="space-y-1.5">
                  {latest.violations.map((violation, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={violation.severity === 'CRITICAL' ? 'destructive' : 'warning'}
                          className="text-[10px] px-1.5 py-0.5"
                        >
                          {violation.severity}
                        </Badge>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {violation.description}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        {violation.observed_value} vs limit {violation.threshold}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History Drawer/List */}
            {showHistory && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Past Evaluations</h5>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {history.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getVerdictBadge(item.verdict)}
                        <span className="text-slate-600 dark:text-slate-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-500">
                        <span>P95: {item.canaryMetrics?.p95_latency_ms?.toFixed(1)}ms</span>
                        <span>RSS: {item.canaryMetrics?.memory_rss_mb?.toFixed(1)}MB</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          Score: {Math.round(item.score)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
