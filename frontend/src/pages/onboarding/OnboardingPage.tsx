import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, Award, UserPlus, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { onboardingService, membersService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { useOrganizationStore } from '@/stores/organizationStore'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'
import { AssignMentorModal, EnhancedChecklistItems } from './components'
import type { Onboarding } from '@/types'

export function OnboardingPage() {
  const queryClient = useQueryClient()
  const { currentOrganization } = useOrganizationStore()

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedMentorId, setSelectedMentorId] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const onboardingQuery = useQuery({
    queryKey: queryKeys.onboarding.all(),
    queryFn: () => onboardingService.getAll(),
  })

  const mentorsQuery = useQuery({
    queryKey: queryKeys.onboarding.availableMentors,
    queryFn: () => onboardingService.getAvailableMentors(),
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.organizations.members(currentOrganization?.id || ''),
    queryFn: () => membersService.getAll(),
    enabled: !!currentOrganization?.id,
  })

  const assignMentorMutation = useMutation({
    mutationFn: ({ trackId, mentorId }: { trackId: string; mentorId: string }) =>
      onboardingService.assignMentor(trackId, mentorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() })
      setSelectedTrackId(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: { userId: string; mentorId?: string }) =>
      onboardingService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.availableMentors })
      setIsCreateOpen(false)
      setSelectedUserId('')
      setSelectedMentorId('')
      setCreateError(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to start onboarding'
      setCreateError(Array.isArray(msg) ? msg.join(', ') : msg)
    },
  })

  const updateChecklistMutation = useMutation({
    mutationFn: ({ trackId, itemId, completed }: { trackId: string; itemId: string; completed: boolean }) =>
      onboardingService.updateChecklistItem(trackId, itemId, { isCompleted: completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() })
    },
  })

  const tracks = onboardingQuery.data ?? []
  const mentors = mentorsQuery.data ?? []
  const members = membersQuery.data ?? []
  const activeCount = tracks.filter((t) => t.status === 'IN_PROGRESS' || (t as any).status === 'ACTIVE').length
  const completedCount = tracks.filter((t) => t.status === 'COMPLETED').length

  const activeUserIds = new Set(
    tracks
      .filter((t) => t.status === 'IN_PROGRESS' || (t as any).status === 'ACTIVE')
      .map((t) => (t as any).userId || t.developerId)
  )

  const eligibleMembers = members.filter((m) => !activeUserIds.has(m.userId))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Onboarding Dashboard"
        description="Track new hire ramp-up progress, checklist completions, and mentor assignments."
        action={
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Start Onboarding
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Active Onboarding Tracks" value={activeCount} icon={<UserCheck className="h-5 w-5" />} />
        <MetricTile label="Graduated Developers" value={completedCount} icon={<CheckCircle2 className="h-5 w-5" />} />
        <MetricTile label="Available Mentors" value={mentors.length} icon={<Award className="h-5 w-5" />} />
      </div>

      <QueryState isLoading={onboardingQuery.isLoading} error={onboardingQuery.error} onRetry={() => onboardingQuery.refetch()}>
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Developer Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tracks.map((track: Onboarding) => {
                const progress = track.progress ?? 0
                const isExpanded = expandedTrackId === track.id
                const devName = (track as any).user?.name || track.developer?.name || track.developerId || 'New Developer'
                const devEmail = (track as any).user?.email || track.developer?.email
                const checklistItems = track.checklistItems || (track as any).checklist || []

                return (
                  <div key={track.id} className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{devName}</h3>
                          {devEmail && <span className="text-xs text-slate-400">({devEmail})</span>}
                          <Badge variant={track.status === 'COMPLETED' ? 'success' : track.status === 'AT_RISK' ? 'destructive' : 'secondary'}>
                            {track.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Mentor: {track.mentor?.name || 'Unassigned'} • Joined: {track.startDate ? new Date(track.startDate).toLocaleDateString() : 'Recent'}
                        </p>

                        <div className="mt-2 w-full max-w-md space-y-1">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Ramp-up Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!track.mentorId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTrackId(track.id)}
                            className="gap-1"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Assign Mentor
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedTrackId(isExpanded ? null : track.id)}
                          className="gap-1"
                        >
                          <ListChecks className="h-3.5 w-3.5" />
                          Checklist
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Onboarding Checklist</h4>
                        <EnhancedChecklistItems
                          items={checklistItems}
                          onToggleItem={(itemId, completed) => {
                            updateChecklistMutation.mutate({
                              trackId: track.id,
                              itemId,
                              completed,
                            })
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              {tracks.length === 0 && (
                <EmptyState
                  title="No Active Onboarding Tracks"
                  description="Enroll newly joined developers into structured onboarding to assign mentors, follow checklists, and track time-to-first-PR."
                  icon={<UserCheck className="h-8 w-8 text-indigo-500" />}
                  action={
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                      <UserPlus className="h-4 w-4" /> Start Onboarding
                    </Button>
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      </QueryState>

      {/* Start Onboarding Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          setCreateError(null)
        }}
        title="Start Developer Onboarding"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedUserId) {
              setCreateError('Please select a developer.')
              return
            }
            createMutation.mutate({
              userId: selectedUserId,
              mentorId: selectedMentorId || undefined,
            })
          }}
          className="space-y-4"
        >
          {createError && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm flex items-center gap-2 dark:bg-red-950 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Select Developer <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value)
                setCreateError(null)
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              required
            >
              <option value="">Choose a developer to onboard...</option>
              {(eligibleMembers.length > 0 ? eligibleMembers : members).map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name || m.user?.email || m.userId} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Assign Mentor (Optional)
            </label>
            <select
              value={selectedMentorId}
              onChange={(e) => setSelectedMentorId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select a mentor (can be assigned later)...</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.currentMentees || 0} mentees)
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                setCreateError(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Start Onboarding
            </Button>
          </div>
        </form>
      </Modal>

      <AssignMentorModal
        open={!!selectedTrackId}
        onClose={() => setSelectedTrackId(null)}
        mentors={mentors}
        onAssign={(mentorId) => {
          if (selectedTrackId) {
            assignMentorMutation.mutate({ trackId: selectedTrackId, mentorId })
          }
        }}
        isPending={assignMentorMutation.isPending}
      />
    </div>
  )
}
