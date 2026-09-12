import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Upload, FileCode2, Loader2, AlertCircle } from 'lucide-react'
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
import type { Repository } from '@/types'

export function CoveragePage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [branch, setBranch] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const coverageQuery = useQuery({
    queryKey: queryKeys.coverage.all({ page: 1, limit: 50 }),
    queryFn: () => coverageService.getAll({ page: 1, limit: 50 }),
  })

  const repositoriesQuery = useQuery({
    queryKey: queryKeys.repositories.all(),
    queryFn: () => repositoriesService.getAll(),
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
  const reports = Array.isArray(rawCoverage) ? rawCoverage : (rawCoverage?.reports ?? [])
  const completed = reports.filter((report) => report.status === 'COMPLETED')
  const averageCoverage =
    completed.length > 0
      ? completed.reduce((sum, report) => sum + (report.coveragePercentage ?? 0), 0) / completed.length
      : 0

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
              <Card key={report.id}>
                <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_12rem_8rem] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-slate-950 dark:text-white">
                        {report.repository?.name ?? report.originalFilename}
                      </h2>
                      <Badge variant={report.status === 'COMPLETED' ? 'success' : report.status === 'FAILED' ? 'danger' : 'secondary'}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {report.format} · {formatBytes(report.fileSize)} · {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <Progress value={report.coveragePercentage ?? 0} showValue label="Line coverage" />
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    {formatNumber(report.linesCovered ?? 0)} / {formatNumber(report.linesTotal ?? 0)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

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
