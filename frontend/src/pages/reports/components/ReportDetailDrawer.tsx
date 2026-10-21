import {
  FileText,
  FileSpreadsheet,
  Download,
  RotateCcw,
  Trash2,
  Copy,
  Calendar,
  Clock,
  Layers,
  Database,
  AlertTriangle,
  ExternalLink,
  GitBranch,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { Report } from '@/types'

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function calculateDuration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  const diffSec = Math.max(0, Math.round((endTime - startTime) / 1000))
  if (diffSec < 60) return `${diffSec}s`
  const minutes = Math.floor(diffSec / 60)
  const remainingSec = diffSec % 60
  return `${minutes}m ${remainingSec}s`
}

export function ReportDetailDrawer({
  report,
  open,
  onClose,
  onDownload,
  onRetry,
  onDelete,
  isDownloading,
  isRetrying,
}: {
  report: Report | null
  open: boolean
  onClose: () => void
  onDownload: (report: Report) => void
  onRetry: (id: string) => void
  onDelete: (id: string) => void
  isDownloading?: boolean
  isRetrying?: boolean
}) {
  if (!report) return null

  const isCompleted = report.status === 'COMPLETED'
  const isProcessing = report.status === 'PROCESSING' || report.status === 'PENDING'
  const isFailed = report.status === 'FAILED'
  const isPdf = (report.type || 'PDF').toUpperCase() === 'PDF'

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const duration = calculateDuration(report.createdAt, report.completedAt)

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6">
        <SheetHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                  isPdf
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/60'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/60'
                }`}
              >
                {isPdf ? <FileText className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {report.title}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 font-mono truncate mt-0.5">
                  {report.filename || `${report.id}.${isPdf ? 'pdf' : 'csv'}`}
                </SheetDescription>
              </div>
            </div>

            <div>
              {isCompleted && (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs"
                >
                  Ready for Export
                </Badge>
              )}
              {isProcessing && (
                <Badge
                  variant="outline"
                  className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-xs animate-pulse"
                >
                  Compiling...
                </Badge>
              )}
              {isFailed && (
                <Badge
                  variant="outline"
                  className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 text-xs"
                >
                  Compilation Failed
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Failed Error Diagnostic Callout */}
        {isFailed && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>Compilation Diagnostic Log</span>
            </div>
            <p className="text-rose-700 dark:text-rose-300 leading-relaxed font-mono text-[11px] bg-rose-100/50 dark:bg-rose-900/30 p-2.5 rounded-lg border border-rose-200/50 dark:border-rose-800/50">
              {report.errorMessage || 'Report generation worker encountered an unexpected timeout during PDF rendering.'}
            </p>
            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetry(report.id)}
                isLoading={isRetrying}
                className="text-xs border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry Report Compilation
              </Button>
            </div>
          </div>
        )}

        {/* Key Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Report Scope</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              {report.scope || 'ORGANIZATION'}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Export Format</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5">
              <Database className="h-3.5 w-3.5 text-slate-400" />
              {isPdf ? 'PDF Document (.pdf)' : 'CSV Spreadsheet (.csv)'}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Artifact Size</p>
            <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
              {report.fileSize ? formatBytes(report.fileSize) : 'Pending compilation'}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compilation Time</p>
            <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
              {duration ? `${duration} elapsed` : 'Asynchronous job'}
            </p>
          </div>
        </div>

        {/* Execution & Date Window */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-indigo-500" />
            Audit &amp; Telemetry Time Window
          </h4>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Coverage Range:</span>
              <span className="font-mono text-slate-900 dark:text-slate-100">
                {report.startDate && report.endDate
                  ? `${new Date(report.startDate).toLocaleDateString()} to ${new Date(report.endDate).toLocaleDateString()}`
                  : 'Standard 30-Day Window'}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2">
              <span className="text-slate-500">Initiated At:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {new Date(report.createdAt).toLocaleString()}
              </span>
            </div>

            {report.completedAt && (
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2">
                <span className="text-slate-500">Completed At:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date(report.completedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Entity Association / Deep Link */}
        {report.developerId && (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Target Developer Profile</p>
              <p className="text-[11px] text-slate-500">View live individual contributor quality and telemetry.</p>
            </div>
            <Link
              to={`/developers/${report.developerId}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
            >
              Open Profile <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Target Repository Association / Deep Link */}
        {report.repositoryId && (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-indigo-500" />
                Target Repository
              </p>
              <p className="text-[11px] text-slate-500">
                Code quality telemetry, line coverage, and commits scoped to this repository.
              </p>
            </div>
            <Link
              to={`/coverage?repo=${report.repositoryId}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
            >
              Explore Telemetry <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Artifact Identifier & Copy Utilities */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            Artifact Identifier &amp; Audit Reference
          </h4>
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-mono">
            <span className="truncate text-slate-600 dark:text-slate-400 select-all">{report.id}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(report.id, 'Report ID')}
              className="h-7 px-2 text-xs text-indigo-600 dark:text-indigo-400 gap-1 shrink-0"
            >
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </Button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
          {isCompleted && (
            <Button
              onClick={() => onDownload(report)}
              isLoading={isDownloading}
              className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-xs"
            >
              <Download className="h-4 w-4" />
              Download {isPdf ? 'PDF Report' : 'CSV Spreadsheet'}
            </Button>
          )}

          <div className="flex items-center gap-2">
            {isFailed && (
              <Button
                variant="outline"
                onClick={() => onRetry(report.id)}
                isLoading={isRetrying}
                className="flex-1 text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => onDelete(report.id)}
              className="flex-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Report
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
