import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { qualityGateService } from '@/services/qualityGate.service';

interface PrQualityGateBadgeProps {
  repositoryId?: string;
  prNumber?: number;
  onClick?: () => void;
  className?: string;
}

export const PrQualityGateBadge: React.FC<PrQualityGateBadgeProps> = ({
  repositoryId,
  prNumber,
  onClick,
  className = '',
}) => {
  const isEnabled = !!repositoryId && typeof prNumber === 'number' && prNumber > 0;

  const { data: gate, isLoading } = useQuery({
    queryKey: ['quality-gate', repositoryId, prNumber],
    queryFn: () => qualityGateService.getLatest(repositoryId!, prNumber!),
    enabled: isEnabled,
    staleTime: 60_000,
  });

  if (!isEnabled) {
    return null;
  }

  if (isLoading) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 animate-pulse ${className}`}
      >
        <Shield className="w-3 h-3 animate-spin" />
        <span>Gate: ...</span>
      </span>
    );
  }

  if (!gate) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer ${className}`}
        title="Quality Gate Pending - Click to inspect or run evaluation"
      >
        <Shield className="w-3 h-3 text-slate-400" />
        <span>Gate: Pending</span>
      </button>
    );
  }

  if (gate.status === 'PASSED') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer ${className}`}
        title={`Quality Gate Passed - Defect Risk ${(gate.defectProbability * 100).toFixed(1)}%, Peak Complexity ${gate.maxComplexity}`}
      >
        <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        <span>Gate: Passed</span>
      </button>
    );
  }

  if (gate.status === 'WARNING') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer ${className}`}
        title={`Quality Gate Warning - Defect Risk ${(gate.defectProbability * 100).toFixed(1)}%, Peak Complexity ${gate.maxComplexity}`}
      >
        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        <span>Gate: Warning</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer ${className}`}
      title={`Quality Gate Blocked - Defect Risk ${(gate.defectProbability * 100).toFixed(1)}%, Peak Complexity ${gate.maxComplexity}`}
    >
      <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
      <span>Gate: Blocked</span>
    </button>
  );
};
