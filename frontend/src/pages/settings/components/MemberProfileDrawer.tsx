import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Mail,
  Calendar,
  Users,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Award,
  AlertTriangle,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { OrganizationMember, UserRole } from '@/types'

const ROLE_PERMISSIONS: Record<
  UserRole,
  { label: string; description: string; privileges: string[] }
> = {
  OWNER: {
    label: 'Organization Owner',
    description: 'Complete authority over organizational billing, integrations, and member tenancy.',
    privileges: [
      'Manage organization billing & subscriptions',
      'Invite, promote, and remove administrators',
      'Manage OAuth apps and security integrations',
      'Access full cryptographic audit ledger',
    ],
  },
  ADMIN: {
    label: 'Administrator',
    description: 'Authority to manage platform settings, engineering teams, and access control.',
    privileges: [
      'Connect & configure GitHub repositories',
      'Create and assign engineering squads & projects',
      'Dispatch developer onboarding invitations',
      'Configure system alert thresholds & policies',
    ],
  },
  TEAM_LEAD: {
    label: 'Engineering Team Lead',
    description: 'Sprint governance, review debt management, and mentorship coordination.',
    privileges: [
      'Manage sprint milestones and delivery goals',
      'Assign code review mentors during onboarding',
      'Triage architectural technical debt hotspots',
      'Oversee squad pull request quality gates',
    ],
  },
  DEVELOPER: {
    label: 'Software Engineer',
    description: 'Standard contributor access for code commits, reviews, and telemetry.',
    privileges: [
      'Submit and merge pull requests with automated DQS scoring',
      'Participate in peer code reviews & quality gates',
      'Track individual developer quality score & velocity',
      'Complete assigned onboarding checklist workflows',
    ],
  },
  VIEWER: {
    label: 'Read-Only Observer',
    description: 'Telemetry and analytics monitoring without mutation rights.',
    privileges: [
      'Inspect engineering quality dashboards',
      'Review release canary telemetry & regression logs',
      'View aggregated team performance benchmarks',
    ],
  },
}

export function MemberProfileDrawer({
  member,
  open,
  onClose,
  onUpdateRole,
  onRemove,
  isUpdatingRole,
}: {
  member: OrganizationMember | null
  open: boolean
  onClose: () => void
  onUpdateRole: (memberId: string, role: UserRole) => void
  onRemove: (memberId: string) => void
  isUpdatingRole?: boolean
}) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('DEVELOPER')

  useEffect(() => {
    if (member) {
      setSelectedRole(member.role)
    }
  }, [member])

  if (!member) return null

  const memberName = member.user?.name || member.user?.email || 'Unnamed Member'
  const memberEmail = member.user?.email || ''
  const isMemberActive = member.status === 'ACTIVE' || (!member.status && member.role === 'OWNER')
  const squads: string[] =
    (member.user as any)?.teamMemberships?.map((tm: any) => tm.team?.name).filter(Boolean) || []

  const roleInfo = ROLE_PERMISSIONS[selectedRole] || ROLE_PERMISSIONS.DEVELOPER

  const handleRoleChange = (newRole: UserRole) => {
    setSelectedRole(newRole)
    if (newRole !== member.role) {
      onUpdateRole(member.userId || member.id, newRole)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6">
        <SheetHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                name={memberName}
                src={member.user?.avatarUrl}
                className="h-12 w-12 text-sm font-bold border border-slate-200 dark:border-slate-800"
              />
              <div>
                <SheetTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {memberName}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3 w-3" />
                  <span>{memberEmail}</span>
                </SheetDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                isMemberActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }
            >
              {isMemberActive ? 'Active Account' : 'Invite Pending'}
            </Badge>
          </div>
        </SheetHeader>

        {/* Member Metadata Overview */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tenancy Joined</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {new Date(member.joinedAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Role</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
              {member.role}
            </p>
          </div>
        </div>

        {/* Squad Affiliations */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-500" />
            Engineering Squads &amp; Teams
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            {squads.length > 0 ? (
              squads.map((squad, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  {squad}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No squads currently assigned.</span>
            )}
          </div>
        </div>

        {/* Developer Quality Intelligence Profile Link */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Developer Quality Workbench
              </p>
              <p className="text-[11px] text-slate-500">
                View DQS scores, commit telemetry, and review velocity.
              </p>
            </div>
          </div>
          <Link
            to={`/developers/${member.userId || member.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
          >
            Open Profile <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Role Permissions Management */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
              Role Permissions &amp; Access Control
            </h4>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assign System Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                disabled={isUpdatingRole}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="OWNER">Owner (Full Tenancy Control)</option>
                <option value="ADMIN">Admin (Settings, Teams &amp; Invites)</option>
                <option value="TEAM_LEAD">Team Lead (Sprint &amp; Review Governance)</option>
                <option value="DEVELOPER">Developer (Contributor &amp; Telemetry)</option>
                <option value="VIEWER">Viewer (Read-Only Access)</option>
              </select>
            </div>

            {/* Role Privileges Card */}
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {roleInfo.label}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {selectedRole}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {roleInfo.description}
              </p>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1">
                {roleInfo.privileges.map((priv, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>{priv}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-red-100 dark:border-red-950/60 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Danger Zone
          </h4>
          <p className="text-xs text-slate-500">
            Removing this user will revoke all platform access, repository scoring links, and organization roles immediately.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(member.userId || member.id)}
            className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/60 gap-1.5 mt-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove Member from Organization
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
