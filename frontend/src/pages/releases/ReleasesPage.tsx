import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Rocket, Plus, ArrowRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { releasesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'
import type { Release, ReleaseStatus } from '@/types'

export function ReleasesPage() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [version, setVersion] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const releasesQuery = useQuery({
    queryKey: queryKeys.releases.all(),
    queryFn: () => releasesService.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (data: { version: string; description?: string; targetDate: string }) =>
      releasesService.create({ version: data.version, description: data.description, targetDate: data.targetDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.all() })
      setIsCreateOpen(false)
      setVersion('')
      setDescription('')
      setTargetDate('')
    },
  })

  const rawReleases = releasesQuery.data
  const releases: Release[] = Array.isArray(rawReleases)
    ? rawReleases
    : (rawReleases && typeof rawReleases === 'object' && Array.isArray((rawReleases as any).data))
    ? (rawReleases as any).data
    : (rawReleases && typeof rawReleases === 'object' && Array.isArray((rawReleases as any).releases))
    ? (rawReleases as any).releases
    : []
  const resolveReleaseStatus = (r: Release): ReleaseStatus => {
    if (r.isRolledBack) return 'ROLLED_BACK'
    if (r.status) return r.status
    if (r.shippedAt) return 'RELEASED'
    return 'PLANNED'
  }

  const releasedCount = releases.filter((r) => resolveReleaseStatus(r) === 'RELEASED').length
  const pendingCount = releases.filter((r) => {
    const s = resolveReleaseStatus(r)
    return s === 'DRAFT' || s === 'PLANNED' || s === 'IN_PROGRESS' || s === 'READY'
  }).length

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!version.trim()) return
    if (!targetDate) return
    createMutation.mutate({ version, description, targetDate })
  }

  const getStatusBadge = (status: ReleaseStatus) => {
    switch (status) {
      case 'RELEASED':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Released</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> In Progress</Badge>
      case 'ROLLED_BACK':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Rolled Back</Badge>
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Planned</Badge>
    }
  }

  return (
    <div>
      <PageHeader
        title="Releases"
        description="Plan software releases, manage release readiness checks, and track deployment status."
        action={
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Create Release
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricTile label="Total Releases" value={releases.length} icon={<Rocket className="h-5 w-5" />} />
        <MetricTile label="Shipped Releases" value={releasedCount} icon={<CheckCircle2 className="h-5 w-5" />} />
        <MetricTile label="Upcoming / In Progress" value={pendingCount} icon={<Clock className="h-5 w-5" />} />
      </div>

      <QueryState isLoading={releasesQuery.isLoading} error={releasesQuery.error} onRetry={() => releasesQuery.refetch()}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {releases.map((release: Release) => (
            <Card key={release.id} className="group flex h-full flex-col transition-all hover:border-blue-300 dark:hover:border-blue-700">
              <CardContent className="flex h-full flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-slate-950 dark:text-white truncate">
                        {release.version}
                      </h2>
                      <p className="text-xs text-blue-600 dark:text-blue-400">{release.description || 'Release package'}</p>
                    </div>
                    {getStatusBadge(resolveReleaseStatus(release))}
                  </div>

                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    {release.description || 'No release notes or description available.'}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Target: {release.targetDate ? new Date(release.targetDate).toLocaleDateString() : 'TBD'}</span>
                    <span>Readiness: {release.readiness?.score !== undefined ? `${Math.round(release.readiness.score)}%` : 'N/A'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-2">
                  <Link to={`/releases/${release.id}`}>
                    <Button variant="outline" className="w-full justify-between gap-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40">
                      View Release Details
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryState>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Release">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Version Tag</label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. v2.4.0" required className="mt-1 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional release notes..." className="mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Target Date</label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create Release</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
