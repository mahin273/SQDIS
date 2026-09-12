import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Download,
  Calendar,
  Activity,
  AlertOctagon,
  ExternalLink,
  Github,
  Play,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { releasesService, repositoriesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'
import { CanaryTelemetryRadarCard } from './components'
import type { ReleaseStatus, ShipReleaseRequest, ShipReleaseResponse } from '@/types'

export function ReleaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  // State for Ship Release Modal & Options
  const [isShipModalOpen, setIsShipModalOpen] = useState(false)
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [createGitHubRelease, setCreateGitHubRelease] = useState(true)
  const [tagName, setTagName] = useState('')
  const [releaseTitle, setReleaseTitle] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [triggerWorkflow, setTriggerWorkflow] = useState(true)
  const [workflowFileName, setWorkflowFileName] = useState('ci.yml')
  const [gitRef, setGitRef] = useState('main')
  const [shipResult, setShipResult] = useState<ShipReleaseResponse | null>(null)

  const releaseQuery = useQuery({
    queryKey: queryKeys.releases.detail(id ?? ''),
    queryFn: () => releasesService.getById(id!),
    enabled: !!id,
  })

  const readinessQuery = useQuery({
    queryKey: queryKeys.releases.readiness(id ?? ''),
    queryFn: () => releasesService.getReadiness(id!),
    enabled: !!id,
  })

  const reposQuery = useQuery({
    queryKey: ['github', 'repositories'],
    queryFn: () => repositoriesService.getAll(),
  })

  const repos = reposQuery.data || []

  const shipMutation = useMutation({
    mutationFn: (req: ShipReleaseRequest) => releasesService.ship(id!, req),
    onSuccess: (data) => {
      setShipResult(data)
      setIsShipModalOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.all() })
    },
  })

  const release = releaseQuery.data
  const readiness = readinessQuery.data
  const currentStatus: ReleaseStatus = release?.isRolledBack
    ? 'ROLLED_BACK'
    : release?.shippedAt
    ? 'RELEASED'
    : release?.status || 'PLANNED'

  const handleOpenShipModal = () => {
    if (release) {
      const defaultTag = release.version.startsWith('v') ? release.version : `v${release.version}`
      setTagName(defaultTag)
      setReleaseTitle(`Release ${defaultTag}`)
      setReleaseNotes(release.description || '')
      if (repos.length > 0 && !selectedRepoId) {
        setSelectedRepoId(repos[0].id)
      }
    }
    setIsShipModalOpen(true)
  }

  const handleConfirmShip = (e: React.FormEvent) => {
    e.preventDefault()
    shipMutation.mutate({
      repositoryId: selectedRepoId || (repos[0]?.id),
      createGitHubRelease,
      tagName: tagName.trim() || undefined,
      releaseName: releaseTitle.trim() || undefined,
      releaseNotes: releaseNotes.trim() || undefined,
      triggerWorkflow,
      workflowFileName: workflowFileName.trim() || 'ci.yml',
      gitRef: gitRef.trim() || 'main',
    })
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/releases" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" /> Back to Releases
        </Link>
      </div>

      <QueryState isLoading={releaseQuery.isLoading} error={releaseQuery.error} onRetry={() => releaseQuery.refetch()}>
        {release && (
          <div>
            <PageHeader
              title={
                <div className="flex items-center gap-3">
                  <span>{release.version}</span>
                  {release.isRolledBack && (
                    <Badge variant="destructive" className="gap-1 text-xs py-1 px-2.5 font-bold">
                      <AlertOctagon className="h-3.5 w-3.5" /> ROLLED BACK
                    </Badge>
                  )}
                  {currentStatus === 'RELEASED' && (
                    <Badge variant="success" className="gap-1 text-xs py-1 px-2.5 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> SHIPPED
                    </Badge>
                  )}
                </div>
              }
              description={`Target deployment date: ${release.targetDate ? new Date(release.targetDate).toLocaleDateString() : 'TBD'}${
                release.isRolledBack && release.rolledBackAt
                  ? ` • Rolled back on ${new Date(release.rolledBackAt).toLocaleDateString()}`
                  : release.shippedAt
                  ? ` • Shipped on ${new Date(release.shippedAt).toLocaleDateString()}`
                  : ''
              }`}
              action={
                <div className="flex gap-2">
                  {!release.isRolledBack && currentStatus !== 'RELEASED' && (
                    <Button
                      onClick={handleOpenShipModal}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Rocket className="h-4 w-4" /> Ship Release
                    </Button>
                  )}
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Export Report
                  </Button>
                </div>
              }
            />

            {/* Ship Results Alert Banner */}
            {shipResult && (
              <Card className="mb-6 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        Release Shipped Successfully!
                      </h4>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                        Release {release.version} has been recorded as deployed in SQDIS.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {/* Option A Result */}
                    {shipResult.githubRelease && (
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-slate-900 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Github className="h-4 w-4" /> Option A: GitHub Release
                          </span>
                          {shipResult.githubRelease.success ? (
                            <Badge variant="success" className="text-[10px] py-0 px-1.5">Published</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Notice</Badge>
                          )}
                        </div>
                        {shipResult.githubRelease.success ? (
                          <div className="mt-2">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Tag: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{shipResult.githubRelease.tagName}</code>
                            </p>
                            {shipResult.githubRelease.htmlUrl && (
                              <a
                                href={shipResult.githubRelease.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                              >
                                View on GitHub <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{shipResult.githubRelease.error}</p>
                        )}
                      </div>
                    )}

                    {/* Option B Result */}
                    {shipResult.workflowDispatch && (
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-slate-900 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Play className="h-4 w-4 text-emerald-500" /> Option B: CI/CD Workflow
                          </span>
                          {shipResult.workflowDispatch.success ? (
                            <Badge variant="success" className="text-[10px] py-0 px-1.5">Dispatched</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Notice</Badge>
                          )}
                        </div>
                        {shipResult.workflowDispatch.success ? (
                          <div className="mt-2">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Workflow: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{shipResult.workflowDispatch.workflow}</code> (ref: {shipResult.workflowDispatch.ref})
                            </p>
                            {shipResult.workflowDispatch.actionsUrl && (
                              <a
                                href={shipResult.workflowDispatch.actionsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                              >
                                View GitHub Actions <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{shipResult.workflowDispatch.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <MetricTile
                label="Release Status"
                value={currentStatus.replace('_', ' ')}
                icon={
                  release.isRolledBack ? (
                    <AlertOctagon className="h-5 w-5 text-rose-500" />
                  ) : currentStatus === 'RELEASED' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-blue-500" />
                  )
                }
              />
              <MetricTile
                label="Readiness Score"
                value={`${Math.round(readiness?.score ?? release.readiness?.score ?? 0)}%`}
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <MetricTile
                label="Target Date"
                value={release.targetDate ? new Date(release.targetDate).toLocaleDateString() : 'TBD'}
                icon={<Calendar className="h-5 w-5" />}
              />
            </div>

            {/* Operational Telemetry & Canary Rollback Analysis */}
            <div className="mb-6">
              <CanaryTelemetryRadarCard
                releaseId={release.id}
                releaseVersion={release.version}
                isRolledBack={release.isRolledBack}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Release Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Description</h4>
                    <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                      {release.description || 'No description provided for this release.'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Associated Sprints</h4>
                    {release.sprints && release.sprints.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {release.sprints.map((sprint) => (
                          <div key={sprint.id} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{sprint.name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {(sprint as any).teamName || (sprint as any).team?.name || 'Sprint'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No sprints associated with this release.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Readiness Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {readiness ? (
                    <>
                      {readiness.isAtRisk && (
                        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                          <span>Release is flagged At-Risk: Readiness score or telemetry regression is below tolerance.</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400">Bug Resolution Score</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.bugScore !== undefined ? `${Math.round(readiness.bugScore)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400">Test Coverage Score</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.coverageScore !== undefined ? `${Math.round(readiness.coverageScore)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400">Code Quality (DQS)</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.dqsScore !== undefined ? `${Math.round(readiness.dqsScore)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400">Test Suite Pass Rate</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.testPassRate !== undefined ? `${Math.round(readiness.testPassRate)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-indigo-500" /> Operational Telemetry Stability
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {readiness.telemetryScore !== undefined ? `${Math.round(readiness.telemetryScore)}%` : 'Not run'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span>Readiness metrics are not available yet.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </QueryState>

      {/* Ship Release Modal with Option A and Option B */}
      <Modal
        isOpen={isShipModalOpen}
        onClose={() => setIsShipModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-600" />
            <span>Ship Release: {release?.version}</span>
          </div>
        }
        description="Configure production deployment actions and automated GitHub integrations."
        size="lg"
      >
        <form onSubmit={handleConfirmShip} className="space-y-4 pt-1">
          {/* Repository Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Connected Repository
            </label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName || r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Option A: Auto-Create GitHub Release & Tag */}
          <div
            className={`rounded-lg border p-3.5 transition-all ${
              createGitHubRelease
                ? 'border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createGitHubRelease}
                onChange={(e) => setCreateGitHubRelease(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Github className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  Option A: Auto-Create GitHub Release & Git Tag
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Calls GitHub API to create a Git tag and publish an official release with changelog notes.
                </p>
              </div>
            </label>

            {createGitHubRelease && (
              <div className="mt-3 space-y-2.5 pl-7 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Git Tag Name
                    </label>
                    <Input
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      placeholder="v1.0.1"
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Release Title
                    </label>
                    <Input
                      value={releaseTitle}
                      onChange={(e) => setReleaseTitle(e.target.value)}
                      placeholder="Release v1.0.1"
                      className="text-xs h-8"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Release Notes / Body
                  </label>
                  <textarea
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    placeholder="Release notes, changelog highlights..."
                    rows={2}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Option B: Trigger GitHub Actions CI/CD Workflow */}
          <div
            className={`rounded-lg border p-3.5 transition-all ${
              triggerWorkflow
                ? 'border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={triggerWorkflow}
                onChange={(e) => setTriggerWorkflow(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Play className="h-4 w-4 text-emerald-500" />
                  Option B: Trigger GitHub Actions CI/CD Deployment
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Dispatches a workflow event to your repository to automatically build and deploy the release.
                </p>
              </div>
            </label>

            {triggerWorkflow && (
              <div className="mt-3 space-y-2.5 pl-7 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Workflow File Name
                    </label>
                    <Input
                      value={workflowFileName}
                      onChange={(e) => setWorkflowFileName(e.target.value)}
                      placeholder="ci.yml or deploy.yml"
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Branch / Git Ref
                    </label>
                    <Input
                      value={gitRef}
                      onChange={(e) => setGitRef(e.target.value)}
                      placeholder="main"
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsShipModalOpen(false)}
              disabled={shipMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={shipMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Rocket className="h-4 w-4" /> Confirm & Ship Release
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
