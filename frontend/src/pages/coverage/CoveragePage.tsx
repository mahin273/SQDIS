import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Upload, FileCode2, Loader2, AlertCircle, Eye, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { coverageService, repositoriesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatBytes, formatDate, formatNumber } from '@/lib/utils'
import { MetricTile, PageHeader, QueryState, formatScore } from '../pageUtils'
import type { Repository, CoverageReport } from '@/types'

export function CoveragePage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [branch, setBranch] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Inspection modal state
  const [viewingReportId, setViewingReportId] = useState<string | null>(null)
  const [moduleSearch, setModuleSearch] = useState('')

  const coverageQuery = useQuery({
    queryKey: queryKeys.coverage.all({ page: 1, limit: 50 }),
    queryFn: () => coverageService.getAll({ page: 1, limit: 50 }),
  })

  const repositoriesQuery = useQuery({
    queryKey: queryKeys.repositories.all(),
    queryFn: () => repositoriesService.getAll(),
  })

  // Detailed report query for the inspection modal
  const reportDetailQuery = useQuery({
    queryKey: queryKeys.coverage.detail(viewingReportId ?? ''),
    queryFn: () => coverageService.getById(viewingReportId!),
    enabled: !!viewingReportId,
  })

  const repositories: Repository[] = repositoriesQuery.data ?? []

  // Auto-select first repository if none selected
  useEffect(() => {
    if (!selectedRepoId && repositories.length > 0) {
      setSelectedRepoId(repositories[0].id)
    }
  }, [selectedRepoId, repositories])

  const handleOpenUpload = () => {
    setUploadError(null)
    setIsUploadOpen(true)
  }

  const handleCloseUpload = () => {
    if (isUploading) return
    setIsUploadOpen(false)
    setFile(null)
    setUploadError(null)
    setBranch('')
    setCommitSha('')
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !selectedRepoId) {
      setUploadError('Please select a repository and choose a coverage file.')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      await coverageService.upload(file, selectedRepoId, {
        branch: branch.trim() || undefined,
        commitSha: commitSha.trim() || undefined,
      })

      toast('Coverage report uploaded successfully! Processing started.', { type: 'success' })
      handleCloseUpload()
      coverageQuery.refetch()
      queryClient.invalidateQueries({ queryKey: ['coverage'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to upload coverage report'
      setUploadError(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setIsUploading(false)
    }
  }

  const rawCoverage = coverageQuery.data
  const reports: CoverageReport[] = Array.isArray(rawCoverage) ? rawCoverage : (rawCoverage?.reports ?? [])
  const completed = reports.filter((report) => report.status === 'COMPLETED')
  const averageCoverage =
    completed.length > 0
      ? completed.reduce((sum, report) => sum + (report.coveragePercentage ?? 0), 0) / completed.length
      : 0

  // Active viewing report
  const viewingReport = reportDetailQuery.data ?? reports.find((r) => r.id === viewingReportId) ?? null

  // Filtered module list for the inspection modal
  const filteredModules = useMemo(() => {
    if (!viewingReport?.modules) return []
    if (!moduleSearch.trim()) return viewingReport.modules
    const q = moduleSearch.toLowerCase()
    return viewingReport.modules.filter((m) => m.modulePath.toLowerCase().includes(q))
  }, [viewingReport?.modules, moduleSearch])

  return (
    <div>
      <PageHeader
        title="Coverage"
        description="Inspect uploaded coverage reports and repository coverage movement."
        action={
          <Button
            onClick={handleOpenUpload}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Upload report
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricTile label="Reports" value={formatNumber(coverageQuery.data?.total ?? reports.length)} icon={<ShieldCheck className="h-5 w-5" />} />
        <MetricTile label="Completed" value={completed.length} />
        <MetricTile label="Average coverage" value={`${formatScore(averageCoverage)}%`} />
      </div>

      <QueryState isLoading={coverageQuery.isLoading} error={coverageQuery.error} onRetry={() => coverageQuery.refetch()}>
        {reports.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                title="No coverage reports found"
                description="No test coverage reports have been uploaded yet. Upload an LCOV, Cobertura, or JaCoCo report to track repository test coverage."
                icon={<ShieldCheck className="h-7 w-7 text-indigo-500" />}
                action={
                  <Button
                    onClick={handleOpenUpload}
                    leftIcon={<Upload className="h-4 w-4" />}
                  >
                    Upload report
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card
                key={report.id}
                className="hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer"
                onClick={() => setViewingReportId(report.id)}
              >
                <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_12rem_8rem_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-slate-950 dark:text-white">
                        {report.repository?.name ?? report.originalFilename}
                      </h2>
                      <Badge variant={report.status === 'COMPLETED' ? 'success' : report.status === 'FAILED' ? 'danger' : 'secondary'}>
                        {report.status}
                      </Badge>
                      {report.branch && (
                        <Badge variant="outline" className="text-xs">
                          {report.branch}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {report.format} · {formatBytes(report.fileSize)} · {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <Progress value={report.coveragePercentage ?? 0} showValue label="Line coverage" />
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    {formatNumber(report.linesCovered ?? 0)} / {formatNumber(report.linesTotal ?? 0)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewingReportId(report.id)
                    }}
                    leftIcon={<Eye className="h-3.5 w-3.5" />}
                  >
                    View report
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      {/* Report Inspection Modal */}
      <Modal
        isOpen={!!viewingReportId}
        onClose={() => {
          setViewingReportId(null)
          setModuleSearch('')
        }}
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <span>Coverage Report Details</span>
          </div>
        }
        description={
          viewingReport?.repository?.fullName
            ? `Detailed file breakdown for ${viewingReport.repository.fullName} (${viewingReport.originalFilename})`
            : viewingReport?.originalFilename
        }
        size="lg"
        footer={
          <div className="flex justify-between items-center w-full">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {filteredModules.length} file{filteredModules.length === 1 ? '' : 's'} displayed
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setViewingReportId(null)
                setModuleSearch('')
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        {reportDetailQuery.isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-2" />
            <p className="text-sm text-slate-500">Loading report breakdown...</p>
          </div>
        ) : viewingReport ? (
          <div className="space-y-5">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Coverage</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {formatScore(viewingReport.coveragePercentage ?? 0)}%
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Lines Covered</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNumber(viewingReport.linesCovered ?? 0)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Lines</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatNumber(viewingReport.linesTotal ?? 0)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Format</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                  {viewingReport.format}
                </p>
              </div>
            </div>

            {/* Metadata strip */}
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span><strong>File:</strong> {viewingReport.originalFilename}</span>
              <span><strong>Size:</strong> {formatBytes(viewingReport.fileSize)}</span>
              {viewingReport.branch && <span><strong>Branch:</strong> {viewingReport.branch}</span>}
              {viewingReport.commitSha && <span><strong>Commit:</strong> <code>{viewingReport.commitSha.slice(0, 7)}</code></span>}
              <span><strong>Uploaded:</strong> {formatDate(viewingReport.createdAt)}</span>
            </div>

            {/* Search and Module Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  File Breakdown ({viewingReport.modules?.length ?? 0} files)
                </h4>
                <div className="relative w-48 sm:w-64">
                  <Input
                    placeholder="Filter files..."
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    leftIcon={<Search className="h-3.5 w-3.5" />}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {filteredModules.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  {viewingReport.modules && viewingReport.modules.length > 0
                    ? 'No files matching search criteria.'
                    : 'No file-level breakdown available in this report.'}
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                  {filteredModules.map((mod, idx) => {
                    const pct = mod.coveragePercentage ?? 0
                    const badgeClass =
                      pct >= 80
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : pct >= 50
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'

                    return (
                      <div key={mod.id || idx} className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileCode2 className="h-4 w-4 text-slate-400 shrink-0" />
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate" title={mod.modulePath}>
                              {mod.modulePath}
                            </p>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-[11px] text-slate-500 shrink-0">
                              {mod.linesCovered} / {mod.linesTotal} lines
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs font-semibold shrink-0 ${badgeClass}`}>
                          {formatScore(pct)}%
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            Report not found.
          </div>
        )}
      </Modal>

      {/* Upload Coverage Report Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={handleCloseUpload}
        title="Upload Coverage Report"
        description="Upload an automated test coverage report (LCOV, Cobertura XML, JaCoCo XML, or NYC JSON)."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseUpload} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || !selectedRepoId || isUploading}
              leftIcon={isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            >
              {isUploading ? 'Uploading...' : 'Upload Report'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUpload} className="space-y-4">
          {uploadError && (
            <div className="flex items-start gap-2 p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Repository *
            </label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Select a repository</option>
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.fullName || repo.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Coverage Report File *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".info,.xml,.json,.txt"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setFile(e.target.files[0])
                  setUploadError(null)
                }
              }}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-lg p-6 text-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900/40"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  <FileCode2 className="h-5 w-5" />
                  <span className="truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-slate-400">({formatBytes(file.size)})</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Click to browse or drop coverage file
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports LCOV (.info), Cobertura (.xml), JaCoCo (.xml), NYC (.json) up to 50MB
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Branch (optional)"
                placeholder="e.g. main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Commit SHA (optional)"
                placeholder="e.g. 4657a2f"
                value={commitSha}
                onChange={(e) => setCommitSha(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default CoveragePage
