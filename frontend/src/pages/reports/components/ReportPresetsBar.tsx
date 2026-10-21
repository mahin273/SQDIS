import { useState } from 'react'
import {
  FileText,
  FileSpreadsheet,
  Award,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ReportScope } from '@/types'

export interface ReportPreset {
  id: string
  title: string
  description: string
  scope: ReportScope
  format: 'pdf' | 'csv'
  days: number
  badge: string
  icon: 'pdf' | 'csv' | 'award' | 'layers'
}

export const REPORT_PRESETS: ReportPreset[] = [
  {
    id: 'executive-quarterly',
    title: 'Executive Quarterly Board Brief',
    description: 'High-level DQS benchmarks, organizational quality health, and SLA governance.',
    scope: 'ORGANIZATION',
    format: 'pdf',
    days: 90,
    badge: 'Quarterly Audit',
    icon: 'pdf',
  },
  {
    id: 'monthly-velocity',
    title: 'Monthly Engineering Velocity Digest',
    description: 'Sprint delivery velocity, code review turnaround, and defect hotspots.',
    scope: 'ORGANIZATION',
    format: 'pdf',
    days: 30,
    badge: 'Monthly Digest',
    icon: 'layers',
  },
  {
    id: 'project-debt-csv',
    title: 'Project Technical Debt & Hotspots Audit',
    description: 'Granular spreadsheet export of codebase technical debt items and file risk levels.',
    scope: 'PROJECT',
    format: 'csv',
    days: 30,
    badge: 'CSV Ledger',
    icon: 'csv',
  },
  {
    id: 'developer-dqs',
    title: 'Developer Quality Scorecard (DQS)',
    description: 'Individual engineer contribution volume, peer review ratios, and ramp-up trajectory.',
    scope: 'DEVELOPER',
    format: 'pdf',
    days: 30,
    badge: 'Individual Profile',
    icon: 'award',
  },
]

export function ReportPresetsBar({
  onSelectPreset,
}: {
  onSelectPreset: (preset: ReportPreset) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            One-Click Executive Presets
          </h3>
          <Badge
            variant="outline"
            className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
          >
            Instant Config
          </Badge>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-7 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 gap-1 px-2"
        >
          <span>{isExpanded ? 'Hide Presets' : 'Show Presets'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {isExpanded && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REPORT_PRESETS.map((preset) => {
            const isPdf = preset.format === 'pdf'

            return (
              <Card
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className="group cursor-pointer border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-xs hover:shadow-sm bg-white dark:bg-slate-900/80"
              >
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                          isPdf
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/60'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/60'
                        }`}
                      >
                        {preset.icon === 'pdf' && <FileText className="h-3.5 w-3.5" />}
                        {preset.icon === 'csv' && <FileSpreadsheet className="h-3.5 w-3.5" />}
                        {preset.icon === 'layers' && <Layers className="h-3.5 w-3.5" />}
                        {preset.icon === 'award' && <Award className="h-3.5 w-3.5" />}
                      </div>
                      <Badge variant="outline" className="text-[10px] font-medium font-mono">
                        {preset.badge}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {preset.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono">{preset.days}d window</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Configure <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
