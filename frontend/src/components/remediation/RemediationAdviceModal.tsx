import React, { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  Sparkles,
  TrendingDown,
  ListOrdered,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RemediationResponse, RemediationRecipe } from '@/types';

interface RemediationAdviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: RemediationResponse | null;
  isLoading?: boolean;
}

export const RemediationAdviceModal: React.FC<RemediationAdviceModalProps> = ({
  isOpen,
  onClose,
  data,
  isLoading,
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [activeTabs, setActiveTabs] = useState<Record<number, 'after' | 'before'>>({});

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const setTab = (idx: number, tab: 'after' | 'before') => {
    setActiveTabs((prev) => ({ ...prev, [idx]: tab }));
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <Badge variant="destructive" className="gap-1 text-[11px] font-semibold">
            <AlertOctagon className="h-3 w-3" /> Critical
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge variant="warning" className="gap-1 text-[11px] font-semibold">
            <AlertTriangle className="h-3 w-3" /> Warning
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] font-semibold">
            <Sparkles className="h-3 w-3" /> Suggestion
          </Badge>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Automated Refactoring & Remediation Advisor"
      className="max-w-3xl"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Analyzing code structure and diagnosing refactoring opportunities...
            </p>
          </div>
        ) : !data || data.totalSmellsFound === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Clean Architecture</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              No structural code smells or excessive branching detected in this snippet. The code adheres to clean modular principles.
            </p>
          </div>
        ) : (
          <>
            {/* Header summary banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/30">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {data.targetFilePath ? data.targetFilePath.split('/').pop() : 'Analyzed Code Snippet'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Found {data.totalSmellsFound} refactoring {data.totalSmellsFound === 1 ? 'opportunity' : 'opportunities'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Refactoring Potential</p>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {data.refactoringPotentialScore} / 100
                  </p>
                </div>
              </div>
            </div>

            {/* Recipes List */}
            <div className="space-y-4 pt-1">
              {data.recipes.map((recipe: RemediationRecipe, idx: number) => {
                const currentTab = activeTabs[idx] || 'after';
                const codeToShow = currentTab === 'after' ? recipe.afterSnippet : recipe.beforeSnippet;

                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(recipe.severity)}
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{recipe.title}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        <TrendingDown className="h-3.5 w-3.5" />
                        ~{recipe.estimatedComplexityReductionPct}% Complexity
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {recipe.explanation}
                    </p>

                    <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ListOrdered className="h-3.5 w-3.5 text-indigo-500" /> Refactoring Strategy:{' '}
                        <span className="text-indigo-600 dark:text-indigo-400">{recipe.recommendedStrategy}</span>
                      </p>
                      <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-400 text-[11px] pl-1">
                        {recipe.stepByStep.map((step, stepIdx) => (
                          <li key={stepIdx}>{step}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Code Comparison Card */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex rounded-md border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-900">
                          <button
                            onClick={() => setTab(idx, 'after')}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                              currentTab === 'after'
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Refactored (Clean)
                          </button>
                          <button
                            onClick={() => setTab(idx, 'before')}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                              currentTab === 'before'
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Original (Problematic)
                          </button>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(codeToShow, idx)}
                          className="h-7 px-2 text-xs gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Copy Snippet
                            </>
                          )}
                        </Button>
                      </div>

                      <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-normal border border-slate-800 max-h-48">
                        <code>{codeToShow}</code>
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
