import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, AlertTriangle, TrendingUp, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { scoresService, projectsService } from '@/services';
import { queryKeys } from '@/lib/queryClient';
import { PageHeader, QueryState } from '../pageUtils';
import { useDeveloperRealtime } from '@/hooks/useDeveloperRealtime';
import type { RiskModule } from '@/types';
import { QualityGateCard } from '@/components/scores/QualityGateCard';

export function ScoresPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const { data: myScore, isLoading: isScoreLoading, error: scoreError, refetch: refetchScore } = useQuery({
    queryKey: queryKeys.scores.me,
    queryFn: () => scoresService.getMyScore(),
  });

  // Realtime DQS updates over WS
  useDeveloperRealtime('me');

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => projectsService.getAll(),
  });

  const activeProjectId = selectedProjectId || (projects && projects.length > 0 ? projects[0].id : '');

  const { data: riskyModules } = useQuery({
    queryKey: queryKeys.scores.riskyModules(activeProjectId),
    queryFn: () => scoresService.getRiskyModules(activeProjectId),
    enabled: Boolean(activeProjectId && activeProjectId !== 'default'),
  });

  const getDqsGrade = (score?: number) => {
    if (score === undefined || score === null) return { label: 'N/A', color: 'bg-slate-100 text-slate-700' };
    if (score >= 90) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' };
    if (score >= 75) return { label: 'Good', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
    if (score >= 60) return { label: 'Moderate', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
    return { label: 'At Risk', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Scores & DQS"
        description="Monitor your Developer Quality Score, key score factors, and code risk indicators"
      />

      <QueryState isLoading={isScoreLoading} error={scoreError} onRetry={() => refetchScore()}>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main DQS Metric Card */}
          <Card className="md:col-span-1 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-500" />
                Developer Quality Score
              </CardTitle>
              <CardDescription>Composite software quality rating</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="inline-flex items-center justify-center h-28 w-28 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border-4 border-indigo-500/20">
                <span className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {myScore?.score ? Math.round(myScore.score) : 'N/A'}
                </span>
              </div>
              <div>
                <Badge variant="outline" className={`text-xs px-3 py-1 font-semibold ${getDqsGrade(myScore?.score).color}`}>
                  {getDqsGrade(myScore?.score).label}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time updates active via WebSocket
              </p>
            </CardContent>
          </Card>

          {/* Key Metrics Overview */}
          <Card className="md:col-span-2 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Quality Dimensions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Test Coverage</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {myScore?.coverage !== undefined && myScore?.coverage !== null
                      ? `${Math.round(myScore.coverage)}%`
                      : '0%'}
                  </span>
                </div>
                <Progress value={myScore?.coverage ?? 0} className="h-2" />
                {(!myScore?.coverage || myScore.coverage === 0) && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    No automated test reports uploaded yet
                  </p>
                )}
              </div>
              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Review & PR Speed</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {myScore?.reviewSpeed !== null && myScore?.reviewSpeed !== undefined && myScore.reviewSpeed > 0
                      ? `${myScore.reviewSpeed}%`
                      : 'N/A'}
                  </span>
                </div>
                {myScore?.reviewSpeed !== null && myScore?.reviewSpeed !== undefined && myScore.reviewSpeed > 0 ? (
                  <Progress value={myScore.reviewSpeed} className="h-2" />
                ) : (
                  <div
                    className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800"
                    title="No peer review or PR turnaround data recorded yet"
                  />
                )}
              </div>
              <div>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Bug Fix Rate</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {myScore?.bugFixRate !== undefined && myScore?.bugFixRate !== null
                      ? `${myScore.bugFixRate}%`
                      : 'N/A'}
                  </span>
                </div>
                <Progress value={myScore?.bugFixRate ?? 0} className="h-2" />
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

        {/* Risky Modules Panel */}
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
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {riskyModules && riskyModules.length > 0 ? (
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
                            Recommendation: {module.recommendation} | Risk Factors: {module.riskFactors.join(', ')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400">
                        Score: {module.riskScore}
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
