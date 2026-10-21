import {
  CheckCircle2,
  Circle,
  Clock,
  Award,
  GitCommit,
  GitPullRequest,
  CheckSquare,
  ShieldCheck,
  Flame,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { Onboarding, MilestoneType } from '@/types'

const MILESTONE_DEFINITIONS: Array<{
  type: MilestoneType
  label: string
  description: string
  icon: React.ReactNode
}> = [
  {
    type: 'FIRST_COMMIT',
    label: 'First Git Commit',
    description: 'Local development environment, Docker, and repository setup confirmed.',
    icon: <GitCommit className="h-4 w-4" />,
  },
  {
    type: 'FIRST_BUGFIX',
    label: 'First Bug Fix',
    description: 'Triage and fix of a defect or good-first-issue.',
    icon: <Flame className="h-4 w-4" />,
  },
  {
    type: 'FIRST_FEATURE',
    label: 'First Feature Branch',
    description: 'Implementation of initial feature task or architectural unit.',
    icon: <CheckSquare className="h-4 w-4" />,
  },
  {
    type: 'FIRST_REVIEW',
    label: 'First Code Review',
    description: 'Peer code review participation and approval cycle.',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    type: 'FIRST_PR_MERGED',
    label: 'First Merged Pull Request',
    description: 'Critical Time-to-First-PR milestone merged into mainline.',
    icon: <GitPullRequest className="h-4 w-4" />,
  },
  {
    type: 'FIRST_TEST',
    label: 'First Test Suite Addition',
    description: 'Added automated unit or integration tests to codebase.',
    icon: <Award className="h-4 w-4" />,
  },
]

export function DeveloperJourneyDrawer({
  track,
  open,
  onClose,
  onToggleChecklist,
  onReassignMentor,
  onComplete,
  onOpenExtend,
  isToggling,
  isCompleting,
}: {
  track: Onboarding | null
  open: boolean
  onClose: () => void
  onToggleChecklist: (trackId: string, itemId: string, completed: boolean) => void
  onReassignMentor: (trackId: string) => void
  onComplete: (trackId: string) => void
  onOpenExtend: (trackId: string) => void
  isToggling?: boolean
  isCompleting?: boolean
}) {
  if (!track) return null

  const devName = track.user?.name || track.developer?.name || track.developerId || 'New Developer'
  const devEmail = track.user?.email || track.developer?.email
  const squadName =
    (track.user as any)?.teamMemberships?.[0]?.team?.name ||
    (track.developer as any)?.teamMemberships?.[0]?.team?.name ||
    'Core Engineering'
  const progress = track.progress ?? 0
  const checklistItems = track.checklistItems || []
  const completedChecklistCount = checklistItems.filter((i) => i.isCompleted || (i as any).completedAt).length
  const milestones = track.milestones || []

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6">
        <SheetHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-sm text-indigo-700 dark:text-indigo-300">
                {devName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <SheetTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {devName}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>{devEmail}</span>
                  <span>•</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{squadName}</span>
                </SheetDescription>
              </div>
            </div>
            <Badge
              variant={
                track.status === 'COMPLETED'
                  ? 'success'
                  : track.status === 'AT_RISK'
                  ? 'destructive'
                  : 'secondary'
              }
              className="capitalize"
            >
              {track.status === 'ACTIVE' || track.status === 'IN_PROGRESS' ? 'In Progress' : track.status}
            </Badge>
          </div>
        </SheetHeader>

        {/* Progress Overview Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700 dark:text-slate-300">Overall Ramp-Up Progress</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
            <div>
              <p className="text-slate-400 text-[11px]">Tasks Verified</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {completedChecklistCount} of {checklistItems.length}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Cohort Window</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Day {track.daysElapsed || 1} of {track.totalDays || 90}
              </p>
            </div>
          </div>
        </div>

        {/* Milestones Stepper Journey */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-indigo-500" />
              Ramp-Up Milestone Journey
            </h4>
            <span className="text-[11px] font-mono text-slate-400">
              {milestones.length} of {MILESTONE_DEFINITIONS.length} achieved
            </span>
          </div>

          <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-800 ml-3 pl-4">
            {MILESTONE_DEFINITIONS.map((def) => {
              const achieved = milestones.find((m) => m.type === def.type)
              return (
                <div key={def.type} className="relative group py-1.5">
                  <div
                    className={`absolute -left-[23px] top-2.5 h-3.5 w-3.5 rounded-full border-2 bg-white dark:bg-slate-950 transition-colors ${
                      achieved
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          {def.label}
                        </span>
                        {achieved && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                            Achieved
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        {def.description}
                      </p>
                    </div>
                    {achieved && (
                      <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                        {new Date(achieved.achievedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Interactive Checklist Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-indigo-500" />
              Onboarding Checklist ({completedChecklistCount}/{checklistItems.length})
            </h4>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-2">
            {checklistItems.map((item) => {
              const isDone = item.isCompleted || (item as any).completedAt !== null && (item as any).completedAt !== undefined
              return (
                <div
                  key={item.id}
                  onClick={() => !isToggling && onToggleChecklist(track.id, item.id, !isDone)}
                  className="flex items-start gap-3 py-2.5 px-2 rounded-md hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium leading-tight ${
                        isDone
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
            {checklistItems.length === 0 && (
              <p className="text-xs text-slate-400 py-3 text-center">No checklist items configured.</p>
            )}
          </div>
        </div>

        {/* Mentorship Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 font-semibold text-xs">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned Mentor</p>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {track.mentor?.name || 'Unassigned'}
              </p>
              {track.mentor?.email && (
                <p className="text-[11px] text-slate-500">{track.mentor.email}</p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReassignMentor(track.id)}
            className="text-xs h-8"
          >
            {track.mentorId ? 'Change Mentor' : 'Assign Mentor'}
          </Button>
        </div>

        {/* Administrative Actions */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenExtend(track.id)}
            className="text-xs gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" /> Extend Window
          </Button>
          {track.status !== 'COMPLETED' && (
            <Button
              size="sm"
              onClick={() => onComplete(track.id)}
              isLoading={isCompleting}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Onboarding Complete
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
