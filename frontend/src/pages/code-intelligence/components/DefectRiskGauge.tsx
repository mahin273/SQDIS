import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface DefectRiskGaugeProps {
  probability: number; // 0.0 to 1.0
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  isDefectProne: boolean;
  benchmark?: string;
  className?: string;
}

export const DefectRiskGauge: React.FC<DefectRiskGaugeProps> = ({
  probability,
  riskLevel,
  isDefectProne,
  benchmark = 'Defect Prediction Model',
  className,
}) => {
  const percentage = Math.round(probability * 100);

  // SVG circular calculation (radius = 54, circumference ~ 339.29)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (probability * circumference);

  const getTheme = () => {
    switch (riskLevel) {
      case 'HIGH':
        return {
          stroke: '#ef4444',
          bgCircle: 'text-rose-100 dark:text-rose-950/40',
          badgeBg: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900/50',
          icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
          label: isDefectProne ? 'DEFECT-PRONE' : 'HIGH RISK',
        };
      case 'MODERATE':
        return {
          stroke: '#f59e0b',
          bgCircle: 'text-amber-100 dark:text-amber-950/40',
          badgeBg: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900/50',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          label: 'MODERATE RISK',
        };
      case 'LOW':
      default:
        return {
          stroke: '#10b981',
          bgCircle: 'text-emerald-100 dark:text-emerald-950/40',
          badgeBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900/50',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
          label: 'CLEAN BASELINE',
        };
    }
  };

  const theme = getTheme();

  return (
    <div className={cn('flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm', className)}>
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          {/* Background track circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            strokeWidth="10"
            className={theme.bgCircle}
            fill="transparent"
            stroke="currentColor"
          />
          {/* Animated progress circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            strokeWidth="10"
            fill="transparent"
            stroke={theme.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {percentage}%
          </span>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Defect Risk
          </span>
        </div>
      </div>

      {/* Risk Badge */}
      <div className={cn('mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border', theme.badgeBg)}>
        {theme.icon}
        <span>{theme.label} ({riskLevel})</span>
      </div>

      <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400">
        Model: <span className="font-medium text-slate-700 dark:text-slate-300">{benchmark}</span>
      </p>
    </div>
  );
};
