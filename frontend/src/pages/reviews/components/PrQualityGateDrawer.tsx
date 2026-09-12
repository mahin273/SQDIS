import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Zap,
  Activity,
  Code2,
  FileText,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { qualityGateService, type QualityGateResult } from '@/services/qualityGate.service';
import { DefectRiskGauge } from '@/pages/code-intelligence/components/DefectRiskGauge';

interface PrQualityGateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  repositoryId?: string;
  prNumber?: number;
  prTitle?: string;
  authorName?: string;
  headCommitSha?: string;
}

export const PrQualityGateDrawer: React.FC<PrQualityGateDrawerProps> = ({
  isOpen,
  onClose,
  repositoryId,
  prNumber,
  prTitle,
  authorName,
  headCommitSha,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'test-impact' | 'bot-report'>('overview');
  const [copied, setCopied] = useState(false);

  const isEnabled = isOpen && !!repositoryId && typeof prNumber === 'number' && prNumber > 0;

  const {
    data: gate,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['quality-gate', repositoryId, prNumber],
    queryFn: () => qualityGateService.getLatest(repositoryId!, prNumber!),
    enabled: isEnabled,
  });

  const evaluateMutation = useMutation({
    mutationFn: () =>
      qualityGateService.evaluate({
        repositoryId: repositoryId!,
        prNumber: prNumber!,
        headCommitSha,
      }),
    onSuccess: (updatedResult: QualityGateResult) => {
      queryClient.setQueryData(['quality-gate', repositoryId, prNumber], updatedResult);
      queryClient.invalidateQueries({ queryKey: ['quality-gate', repositoryId] });
      toast('Quality Gate evaluated successfully', { type: 'success' });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || error?.message || 'Failed to evaluate Quality Gate';
      toast(message, { type: 'error' });
    },
  });

  const handleCopyMarkdown = () => {
    if (!gate?.summaryMarkdown) return;
    navigator.clipboard.writeText(gate.summaryMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Report markdown copied to clipboard', { type: 'success' });
  };

  const getStatusBanner = (status?: string) => {
    switch (status) {
      case 'PASSED':
        return {
          icon: <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          title: 'Quality Gate Passed',
          subtitle: 'All statistical defect and complexity metrics are within safe operational thresholds.',
          border: 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200',
        };
      case 'WARNING':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
          title: 'Quality Gate Warning',
          subtitle: 'Moderate defect risk or complexity detected. Review recommended before merging.',
          border: 'border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200',
        };
      case 'BLOCKED':
        return {
          icon: <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
          title: 'Quality Gate Blocked',
          subtitle: 'Critical risk or severe complexity hotspot found. Resolution required before merging.',
          border: 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200',
        };
      default:
        return {
          icon: <Shield className="w-5 h-5 text-slate-500 shrink-0" />,
          title: 'Quality Gate Pending',
          subtitle: 'Initial automated quality evaluation has not yet run for this changeset.',
          border: 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300',
        };
    }
  };

  const banner = getStatusBanner(gate?.status);
  const isBusy = evaluateMutation.isPending || (isFetching && !isLoading);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex flex-col h-full w-full sm:max-w-2xl p-0 gap-0 overflow-hidden bg-white dark:bg-slate-950"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <SheetHeader className="border-b-0 pb-0">
            <div className="flex items-center justify-between gap-3 pr-8">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Shield className="w-4 h-4" />
                </span>
                <SheetTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Pull Request Quality Gate
                </SheetTitle>
              </div>

              {gate && (
                <Badge
                  variant={
                    gate.status === 'PASSED'
                      ? 'success'
                      : gate.status === 'WARNING'
                      ? 'warning'
                      : 'destructive'
                  }
                  className="gap-1 font-semibold"
                >
                  {gate.status === 'PASSED' && <CheckCircle2 className="w-3 h-3" />}
                  {gate.status === 'WARNING' && <AlertTriangle className="w-3 h-3" />}
                  {gate.status === 'BLOCKED' && <XCircle className="w-3 h-3" />}
                  {gate.status}
                </Badge>
              )}
            </div>

            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Automated defect probability, complexity hotspots, and targeted test suite recommendations.
            </SheetDescription>
          </SheetHeader>

          {/* PR Context strip */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                PR #{prNumber}
              </span>
              <span>•</span>
              <span className="truncate max-w-[280px]" title={prTitle}>
                {prTitle || 'Pull Request'}
              </span>
              {authorName && (
                <>
                  <span>•</span>
                  <span className="text-slate-500">by {authorName}</span>
                </>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => evaluateMutation.mutate()}
              disabled={isBusy}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin text-blue-600' : ''}`} />
              {isBusy ? 'Evaluating...' : 'Re-evaluate Quality Gate'}
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Loading Quality Gate telemetry...
              </p>
            </div>
          ) : !gate ? (
            /* Pending Zero State */
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Quality Gate Pending
                </h3>
                <p className="text-xs text-slate-500">
                  This pull request has not been evaluated by the automated Quality Gate bot yet.
                  Run an on-demand assessment to compute defect probability, code complexity, and test impact.
                </p>
              </div>
              <Button
                onClick={() => evaluateMutation.mutate()}
                disabled={isBusy}
                className="gap-2 font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
                {isBusy ? 'Running Assessment...' : 'Run Quality Gate Assessment'}
              </Button>
            </div>
          ) : (
            /* Evaluated Details View */
            <div className="space-y-6">
              {/* Status Banner */}
              <div className={`rounded-xl border p-4 flex items-start gap-3.5 ${banner.border}`}>
                {banner.icon}
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold">{banner.title}</h4>
                  <p className="text-xs opacity-90">{banner.subtitle}</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as any)}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="overview">Health Overview</TabsTrigger>
                  <TabsTrigger value="test-impact">Test Impact</TabsTrigger>
                  <TabsTrigger value="bot-report">Bot Report</TabsTrigger>
                </TabsList>

                {/* TAB 1: OVERVIEW */}
                <TabsContent value="overview" className="mt-4 space-y-6">
                  {/* Top Metric Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Defect Probability Tile */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-500 text-xs">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">
                          Defect Risk
                        </span>
                        <Activity className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="my-2">
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {(gate.defectProbability * 100).toFixed(1)}%
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">
                          {gate.riskLevel} Risk Tier
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                        Threshold: &lt; 40% Target
                      </div>
                    </div>

                    {/* Peak Complexity Tile */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-500 text-xs">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">
                          Peak Complexity
                        </span>
                        <Code2 className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="my-2">
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {gate.maxComplexity}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">
                          {gate.maxComplexity > 25
                            ? 'Critical Hotspot'
                            : gate.maxComplexity > 15
                            ? 'Moderate Hotspot'
                            : 'Clean Branching'}
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                        Threshold: ≤ 15 Target
                      </div>
                    </div>

                    {/* CI Acceleration Tile */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-500 text-xs">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">
                          Tests Pruned
                        </span>
                        <Zap className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="my-2">
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {gate.prunedPercentage.toFixed(0)}%
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">
                          ~{gate.estimatedTimeSaved}s Saved
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                        Required Suites: {gate.impactedTestsCount}
                      </div>
                    </div>
                  </div>

                  {/* Circular Defect Risk Gauge & Details */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Changeset Defect Risk Analysis
                    </h4>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <DefectRiskGauge
                        probability={gate.defectProbability}
                        riskLevel={
                          gate.riskLevel === 'HIGH' || gate.riskLevel === 'CRITICAL'
                            ? 'HIGH'
                            : gate.riskLevel === 'MEDIUM' || gate.riskLevel === 'MODERATE'
                            ? 'MODERATE'
                            : 'LOW'
                        }
                        isDefectProne={gate.defectProbability > 0.5}
                        benchmark="Statistical Defect Risk Model"
                        className="p-4 border-0 shadow-none bg-transparent"
                      />

                      <div className="flex-1 space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Risk Assessment
                          </span>
                          <p className="text-slate-500 leading-relaxed">
                            {gate.defectProbability > 0.65
                              ? 'This pull request carries elevated defect risk exceeding policy thresholds. Focused code review and targeted unit test verification are recommended.'
                              : gate.defectProbability >= 0.4
                              ? 'Moderate defect probability detected. Review code modifications carefully before approval.'
                              : 'Defect risk is well within acceptable limits. Changeset demonstrates low risk profile.'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Commit Hash</span>
                            <span className="font-mono font-medium">
                              {gate.headCommitSha ? gate.headCommitSha.slice(0, 8) : 'HEAD'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">Status Check</span>
                            <span className="font-medium capitalize">
                              {gate.githubStatusState || 'Reported'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quality Gate Matrix Breakdown */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Gate Verification Checklist
                      </h4>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {/* Item 1: Defect Risk */}
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>Defect Probability Risk</span>
                            <span className="text-slate-400 font-normal">(&lt; 40% target)</span>
                          </div>
                          <p className="text-slate-500">
                            Computed from changeset file entropy, churn, and author historical patterns.
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold ${
                              gate.defectProbability > 0.65
                                ? 'text-rose-600'
                                : gate.defectProbability >= 0.4
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {(gate.defectProbability * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Item 2: Cyclomatic Complexity */}
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>Peak Cyclomatic Complexity</span>
                            <span className="text-slate-400 font-normal">(≤ 15 target)</span>
                          </div>
                          <p className="text-slate-500">
                            Evaluated across modified code methods via AST syntax parsing.
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold ${
                              gate.maxComplexity > 25
                                ? 'text-rose-600'
                                : gate.maxComplexity > 15
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {gate.maxComplexity}
                          </span>
                        </div>
                      </div>

                      {/* Item 3: Test Suite Impact */}
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>Test Impact Verification</span>
                          </div>
                          <p className="text-slate-500">
                            Identifies regression test suites impacted by modified functions.
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {gate.impactedTestsCount} required
                          </span>
                        </div>
                      </div>

                      {/* Item 4: GitHub Bot Synchronization */}
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            GitHub Bot Synchronized
                          </div>
                          <p className="text-slate-500">
                            {gate.githubCommentId
                              ? `Comment published (ID #${gate.githubCommentId})`
                              : 'Comment updated in PR thread'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {gate.githubStatusState || 'SUCCESS'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: TEST IMPACT */}
                <TabsContent value="test-impact" className="mt-4 space-y-6">
                  <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Smart Test Impact Analysis
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      By mapping modified files to dependency call graphs, the system determines which
                      test suites are impacted by this pull request. Unaffected test suites are safely
                      pruned from the regression pipeline.
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-blue-200/60 dark:border-blue-900/60 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          Pruned
                        </span>
                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {gate.prunedPercentage.toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          Time Saved
                        </span>
                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          ~{gate.estimatedTimeSaved}s
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          Required Suites
                        </span>
                        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {gate.impactedTestsCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Recommended Test Execution Strategy
                    </h4>
                    <p className="text-xs text-slate-500">
                      {gate.impactedTestsCount > 0
                        ? `Execute the ${gate.impactedTestsCount} impacted test suite(s) locally or in CI before merging this pull request.`
                        : 'No existing test suites directly cover the touched modules. Consider adding unit tests for newly introduced functions.'}
                    </p>
                  </div>
                </TabsContent>

                {/* TAB 3: BOT REPORT MARKDOWN */}
                <TabsContent value="bot-report" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Generated GitHub Bot Comment
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyMarkdown}
                      className="h-7 text-xs gap-1.5 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Markdown</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[420px] border border-slate-800">
                    {gate.summaryMarkdown || 'No markdown report available.'}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {gate?.createdAt
                ? `Last evaluated ${new Date(gate.createdAt).toLocaleString()}`
                : 'Not evaluated'}
            </span>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
