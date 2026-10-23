import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  AlertTriangle,
  TrendingUp,
  Layers,
  RefreshCw,
  Sparkles,
  Target,
  Clock,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScoreGauge } from '@/components/charts/ScoreGauge';
import { TrendChart, ShapAttributionChart, ChartSuspense } from '@/components/charts';
import { scoresService, projectsService } from '@/services';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useDeveloperRealtime } from '@/hooks/useDeveloperRealtime';
import { PageHeader, QueryState } from '../pageUtils';
import { formatDate } from '@/lib/utils';
import type { RiskModule } from '@/types';
import { QualityGateCard } from '@/components/scores/QualityGateCard';

export function ScoresPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const {
    data: myScore,
    isLoading: isScoreLoading,
    error: scoreError,
    refetch: refetchScore,
  } = useQuery({
    queryKey: queryKeys.scores.me,
    queryFn: () => scoresService.getMyScore(),
  });

  // Realtime DQS updates over WS
  useDeveloperRealtime(user?.id || 'me');

  const {
    data: historyData,
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ['scores', 'dqs', user?.id, 'history'],
    queryFn: () => scoresService.getDQSHistory(user!.id),
    enabled: Boolean(user?.id),
  });

  const recalculateMutation = useMutation({
    mutationFn: () =>
      scoresService.recalculate({
        entityId: user?.id || '',
        type: 'DQS',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scores.me });
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ['scores', 'dqs', user.id, 'history'],
        });
      }
    },
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => projectsService.getAll(),
  });

  const activeProjectId =
    selectedProjectId || (projects && projects.length > 0 ? projects[0].id : '');

  const { data: riskyModules, isError: isRiskyModulesError } = useQuery({
    queryKey: queryKeys.scores.riskyModules(activeProjectId),
    queryFn: () => scoresService.getRiskyModules(activeProjectId),
    enabled: Boolean(activeProjectId && activeProjectId !== 'default'),
    retry: false,
  });

  const getDqsGrade = (score?: number) => {
    if (score === undefined || score === null) {
      return {
        label: 'N/A',
        color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
    }
    if (score >= 90) {
      return {
        label: 'Excellent',
        color:
          'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      };
    }
    if (score >= 75) {
      return {
        label: 'Good',
        color:
          'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
      };
    }
    if (score >= 60) {
      return {
        label: 'Moderate',
        color:
          'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
      };
    }
    return {
      label: 'At Risk',
      color:
        'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    };
  };

  const { trendChartData, trajectoryDelta } = useMemo(() => {
    const rawPoints = Array.isArray(historyData) ? historyData : [];

    if (rawPoints.length === 0) {
      if (myScore?.score !== undefined && myScore.score !== null) {
        return {
          trendChartData: [
            {
              date: new Date().toISOString(),
              label: 'Current',
              value: Math.round(myScore.score),
            },
          ],
          trajectoryDelta: null,
        };
      }
      return { trendChartData: [], trajectoryDelta: null };
    }

    const sorted = [...rawPoints].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const chartPoints = sorted.map((pt) => ({
      date: pt.date,
      label: formatDate(pt.date, { month: 'short', day: 'numeric' }),
      value: Math.round(pt.score),
    }));

    let delta: number | null = null;
    if (sorted.length >= 2) {
      const first = sorted[0].score;
      const last = sorted[sorted.length - 1].score;
      delta = Math.round((last - first) * 10) / 10;
    }

    return { trendChartData: chartPoints, trajectoryDelta: delta };
  }, [historyData, myScore?.score]);

  const rawScore = myScore?.score ? Math.round(myScore.score) : 0;
  const grade = getDqsGrade(myScore?.score);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Quality & Intelligence Hub"
        description="Real-time DQS evaluation, historical score trajectory, and explainable ML feature attribution"
      />

      <QueryState
        isLoading={isScoreLoading}
        error={scoreError}
        onRetry={() => refetchScore()}
      >
        {/* Row 1: Hero Overview (Score Gauge + 30-Day Trajectory) */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main DQS Metric Card with Arc Gauge */}
          <Card className="md:col-span-1 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-500" />
                  Developer Quality Score
                </CardTitle>
                <CardDescription>Composite ML software quality rating</CardDescription>
              </div>
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                title="Connected to real-time WebSocket scoring stream"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </div>
            </CardHeader>
            <CardContent className="pt-4 pb-5 flex flex-col items-center justify-between flex-1">
              <div className="w-full max-w-[220px]">
                <ScoreGauge value={rawScore} size="md" label="Current DQS" />
              </div>

              <div className="flex flex-col items-center gap-3 w-full mt-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs px-3 py-1 font-semibold ${grade.color}`}>
                    {grade.label}
                  </Badge>
                  {myScore?.modelVersion && (
                    <Badge variant="secondary" className="text-[11px] text-slate-500">
                      v{myScore.modelVersion}
                    </Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => recalculateMutation.mutate()}
                  isLoading={recalculateMutation.isPending}
                  disabled={!user?.id || recalculateMutation.isPending}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Recalculate Score
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 30-Day DQS Trajectory Trend */}
          <Card className="md:col-span-2 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  Score Progression & Trajectory
                </CardTitle>
                <CardDescription>Historical 30-day DQS evolution</CardDescription>
              </div>
              {trajectoryDelta !== null && (
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                    trajectoryDelta >= 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {trajectoryDelta >= 0 ? '+' : ''}
                  {trajectoryDelta} pts in 30d
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col justify-center">
              {isHistoryLoading ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                  Loading trajectory...
                </div>
              ) : trendChartData.length > 0 ? (
                <ChartSuspense>
                  <TrendChart data={trendChartData} valueLabel="DQS Score" />
                </ChartSuspense>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                  <Activity className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                  <span>Establishing score baseline. Subsequent evaluations will render trend trajectory.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: ML Explainability (SHAP) & Quality Dimensions */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* AI Score Explainability (SHAP Values) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  ML Score Attribution (SHAP)
                </CardTitle>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Green = Positive | Red = Negative
                </span>
              </div>
              <CardDescription>
                Marginal impact of individual code quality factors on your composite DQS
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ChartSuspense>
                <ShapAttributionChart shapValues={myScore?.shapValues} />
              </ChartSuspense>
            </CardContent>
          </Card>

          {/* Quality Dimensions Breakdown & Prescriptive Action */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" />
                Quality Dimensions & Benchmarks
              </CardTitle>
              <CardDescription>Core software health pillars against target standards</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Test Coverage */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                    Test Coverage
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Target: 80%</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {myScore?.coverage !== undefined && myScore?.coverage !== null
                        ? `${Math.round(myScore.coverage)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
                <Progress value={myScore?.coverage ?? 0} className="h-2" />
                {(!myScore?.coverage || myScore.coverage === 0) && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    No automated test reports uploaded yet
                  </p>
                )}
              </div>

              {/* Review & PR Turnaround */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    Review & PR Speed
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Target: &gt;70%</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {myScore?.reviewSpeed !== null &&
                      myScore?.reviewSpeed !== undefined &&
                      myScore.reviewSpeed > 0
                        ? `${myScore.reviewSpeed}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
                {myScore?.reviewSpeed !== null &&
                myScore?.reviewSpeed !== undefined &&
                myScore.reviewSpeed > 0 ? (
                  <Progress value={myScore.reviewSpeed} className="h-2" />
                ) : (
                  <div
                    className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800"
                    title="No peer review or PR turnaround data recorded yet"
                  />
                )}
              </div>

              {/* Bug Fix Rate */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Bug Fix Rate
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Target: &gt;75%</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {myScore?.bugFixRate !== undefined && myScore?.bugFixRate !== null
                        ? `${myScore.bugFixRate}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
                <Progress value={myScore?.bugFixRate ?? 0} className="h-2" />
              </div>

              {/* Prescriptive Guidance Box */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5 mt-3">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  <Info className="h-3.5 w-3.5 text-indigo-500" />
                  Prescriptive Recommendations
                </div>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  {(!myScore?.coverage || myScore.coverage < 70)
                    ? 'Boost automated test coverage across high-churn modules to lift your overall quality rating.'
                    : (myScore?.bugFixRate && myScore.bugFixRate < 70)
                    ? 'Focus on resolving open bug items in active sprints to increase your bug fix resolution ratio.'
                    : 'Maintain consistent test coverage and peer review turnaround velocity to sustain your current score.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Automated Quality Gate Card */}
        <QualityGateCard
          status={myScore?.qualityGate?.status ?? 'PASSED'}
          totalDebtHours={myScore?.totalDebtHours ?? 2.5}
          violations={myScore?.qualityGate?.violations ?? []}
        />

        {/* Risky Modules Attention Required Panel */}
        {activeProjectId && (
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
                Risky Modules Attention Required
              </CardTitle>
              {projects && projects.length > 1 && (
                <select
                  value={activeProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-slate-700 dark:text-slate-300"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isRiskyModulesError ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Project Not Assigned</p>
                  <p className="mt-1 text-xs text-slate-400">
                    This project is not assigned to any of your active teams. Project SQS telemetry is scoped to assigned teams.
                  </p>
                </div>
              ) : riskyModules && riskyModules.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {riskyModules.map((module: RiskModule, idx: number) => (
                    <div key={idx} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {module.modulePath}
                          </p>
                          <p className="text-xs text-slate-500">
                            Recommendation: {module.recommendation} | Risk Factors:{' '}
                            {Array.isArray(module.riskFactors) && module.riskFactors.length > 0
                              ? module.riskFactors.join(', ')
                              : module.reason || 'High churn or complexity'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          module.risk_level === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400'
                            : module.risk_level === 'HIGH'
                            ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400'
                            : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400'
                        }
                      >
                        {module.risk_level
                          ? `${module.risk_level} (${module.riskScore})`
                          : `Score: ${module.riskScore}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">
                  No high-risk modules detected for this project.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </QueryState>
    </div>
  );
}

export default ScoresPage;
