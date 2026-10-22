export interface CoverageHealthInfo {
  label: 'Healthy' | 'Moderate' | 'At Risk' | 'Processing' | 'Failed' | 'Unmeasured'
  variantClass: string
  isMeasured: boolean
}

/**
 * Evaluates coverage health status, distinguishing genuinely completed, instrumented
 * line coverage from unmeasured reports (0 total lines), pending uploads, and failed builds.
 */
export function getCoverageHealth(
  status: string | undefined,
  percentage: number | null | undefined,
  linesTotal: number | null | undefined
): CoverageHealthInfo {
  if (status !== 'COMPLETED' || linesTotal === null || linesTotal === undefined || linesTotal <= 0) {
    if (status === 'PENDING' || status === 'PROCESSING') {
      return {
        label: 'Processing',
        variantClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
        isMeasured: false,
      }
    }
    if (status === 'FAILED') {
      return {
        label: 'Failed',
        variantClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
        isMeasured: false,
      }
    }
    return {
      label: 'Unmeasured',
      variantClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      isMeasured: false,
    }
  }

  const pct = percentage ?? 0
  if (pct >= 80) {
    return {
      label: 'Healthy',
      variantClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      isMeasured: true,
    }
  }
  if (pct >= 50) {
    return {
      label: 'Moderate',
      variantClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
      isMeasured: true,
    }
  }
  return {
    label: 'At Risk',
    variantClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
    isMeasured: true,
  }
}
