import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Users, Trash2, UserPlus, Search, 
  ShieldCheck, Mail, Calendar, 
  ArrowUpDown, ChevronDown, Check,
  GitBranch, RefreshCw, CheckCircle2,
  Clock, GitCommit
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { membersService, organizationService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { useOrganizationStore } from '@/stores/organizationStore'
import { QueryState } from '../pageUtils'
import type { OrganizationMember, UserRole, RepositoryContributor, Invitation } from '@/types'

const ROLE_COLORS: Record<UserRole, { bg: string, text: string, border: string }> = {
  OWNER: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  ADMIN: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  TEAM_LEAD: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  DEVELOPER: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  VIEWER: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
}

export function MembersPage() {
  const queryClient = useQueryClient()
  const { currentOrganization } = useOrganizationStore()
  
  // Tab state: 'members' | 'contributors' | 'invitations'
  const [activeTab, setActiveTab] = useState<'members' | 'contributors' | 'invitations'>('members')

  // Modals & form state
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('DEVELOPER')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INVITED' | 'UNINVITED'>('ALL')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' })
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)

  // Contributor filter & action state
  const [contributorSearch, setContributorSearch] = useState('')
  const [contributorFilter, setContributorFilter] = useState<'ALL' | 'UNINVITED' | 'INVITED' | 'MEMBER'>('ALL')
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Queries
  const membersQuery = useQuery({
    queryKey: queryKeys.members.all(),
    queryFn: () => membersService.getAll(),
  })

  const contributorsQuery = useQuery({
    queryKey: ['organizations', currentOrganization?.id, 'contributors'],
    queryFn: () => currentOrganization?.id ? organizationService.getRepositoryContributors(currentOrganization.id) : Promise.resolve([]),
    enabled: !!currentOrganization?.id,
  })

  const invitationsQuery = useQuery({
    queryKey: ['organizations', currentOrganization?.id, 'invitations'],
    queryFn: () => currentOrganization?.id ? organizationService.getInvitations(currentOrganization.id) : Promise.resolve([]),
    enabled: !!currentOrganization?.id,
  })

  // Mutations
  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: UserRole }) =>
      membersService.updateRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (targetId: string) => membersService.remove(targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      setMemberToRemove(null)
      setFeedbackMessage({ text: 'Member removed from organization', type: 'success' })
      setTimeout(() => setFeedbackMessage(null), 4000)
    },
    onError: (err: any) => {
      setMemberToRemove(null)
      setFeedbackMessage({
        text: err?.response?.data?.message || err.message || 'Failed to remove member',
        type: 'error',
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    },
  })

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: UserRole }) => {
      if (!currentOrganization) throw new Error('No organization selected')
      return organizationService.inviteMember(currentOrganization.id, { email: data.email })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'contributors'] })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'invitations'] })
      setIsInviteOpen(false)
      setInviteEmail('')
      setInviteRole('DEVELOPER')
      setFeedbackMessage({ text: `Invitation sent to ${variables.email}`, type: 'success' })
      setTimeout(() => setFeedbackMessage(null), 4000)
    },
    onError: (err: any) => {
      setFeedbackMessage({
        text: err?.response?.data?.message || err.message || 'Failed to send invitation',
        type: 'error',
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    },
  })

  const quickInviteMutation = useMutation({
    mutationFn: (email: string) => {
      if (!currentOrganization) throw new Error('No organization selected')
      setInvitingEmail(email)
      return organizationService.inviteMember(currentOrganization.id, { email })
    },
    onSuccess: (_, email) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'contributors'] })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'invitations'] })
      setInvitingEmail(null)
      setFeedbackMessage({ text: `Invitation sent to ${email}`, type: 'success' })
      setTimeout(() => setFeedbackMessage(null), 4000)
    },
    onError: (err: any) => {
      setInvitingEmail(null)
      setFeedbackMessage({
        text: err?.response?.data?.message || err.message || 'Failed to send invitation',
        type: 'error',
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    },
  })

  const resendInviteMutation = useMutation({
    mutationFn: (email: string) => {
      if (!currentOrganization) throw new Error('No organization selected')
      setInvitingEmail(email)
      return organizationService.resendInvitation(currentOrganization.id, { email })
    },
    onSuccess: (_, email) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'contributors'] })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'invitations'] })
      setInvitingEmail(null)
      setFeedbackMessage({ text: `Invitation resent to ${email}`, type: 'success' })
      setTimeout(() => setFeedbackMessage(null), 4000)
    },
    onError: (err: any) => {
      setInvitingEmail(null)
      setFeedbackMessage({
        text: err?.response?.data?.message || err.message || 'Failed to resend invitation',
        type: 'error',
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    },
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (invitationId: string) => {
      if (!currentOrganization) throw new Error('No organization selected')
      return organizationService.revokeInvitation(currentOrganization.id, invitationId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'contributors'] })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'invitations'] })
      setFeedbackMessage({ text: 'Invitation revoked', type: 'success' })
      setTimeout(() => setFeedbackMessage(null), 4000)
    },
  })

  const inviteAllMutation = useMutation({
    mutationFn: () => {
      if (!currentOrganization) throw new Error('No organization selected')
      return organizationService.inviteAll(currentOrganization.id)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'contributors'] })
      queryClient.invalidateQueries({ queryKey: ['organizations', currentOrganization?.id, 'invitations'] })
      setFeedbackMessage({
        text: `Successfully queued invitations for ${res.totalInvited} developers!`,
        type: 'success',
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    },
    onError: (err: any) => {
      setFeedbackMessage({
        text: err?.response?.data?.message || err.message || 'Failed to dispatch invitations',
        type: 'error',
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    },
  })

  // Derived state
  const rawMembers = membersQuery.data
  const members: OrganizationMember[] = Array.isArray(rawMembers)
    ? rawMembers
    : (rawMembers && typeof rawMembers === 'object' && Array.isArray((rawMembers as any).data))
    ? (rawMembers as any).data
    : (rawMembers && typeof rawMembers === 'object' && Array.isArray((rawMembers as any).members))
    ? (rawMembers as any).members
    : []

  const contributors: RepositoryContributor[] = contributorsQuery.data || []
  const invitations: Invitation[] = invitationsQuery.data || []

  const uninvitedMembers = useMemo(() => {
    return members.filter((m) => m.status === 'UNINVITED')
  }, [members])

  const uninvitedContributors = useMemo(() => {
    return contributors.filter((c) => !c.isMember && !c.isInvited)
  }, [contributors])

  const totalUninvitedCount = useMemo(() => {
    const emails = new Set<string>()
    for (const m of uninvitedMembers) {
      if (m.user?.email) emails.add(m.user.email.toLowerCase().trim())
    }
    for (const c of uninvitedContributors) {
      if (c.email) emails.add(c.email.toLowerCase().trim())
    }
    return emails.size
  }, [uninvitedMembers, uninvitedContributors])

  const stats = useMemo(() => {
    return members.reduce(
      (acc, member) => {
        acc.total++
        acc[member.role] = (acc[member.role] || 0) + 1
        return acc
      },
      { total: 0 } as Record<string, number>
    )
  }, [members])

  const filteredAndSortedMembers = useMemo(() => {
    const result = members.filter((member) => {
      const matchesSearch =
        member.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.user?.email.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRole = roleFilter === 'ALL' || member.role === roleFilter

      const isMemberActive = member.status === 'ACTIVE' || (!member.status && member.role === 'OWNER')
      const isMemberInvited = member.status === 'INVITED'
      const isMemberUninvited = member.status === 'UNINVITED' || (!member.status && !isMemberActive)

      let matchesStatus = true
      if (statusFilter === 'ACTIVE') matchesStatus = isMemberActive
      else if (statusFilter === 'INVITED') matchesStatus = isMemberInvited
      else if (statusFilter === 'UNINVITED') matchesStatus = isMemberUninvited

      return matchesSearch && matchesRole && matchesStatus
    })

    result.sort((a, b) => {
      let valA, valB
      if (sortConfig.key === 'name') {
        valA = (a.user?.name || a.user?.email || '').toLowerCase()
        valB = (b.user?.name || b.user?.email || '').toLowerCase()
      } else if (sortConfig.key === 'role') {
        valA = a.role
        valB = b.role
      } else {
        valA = new Date(a.joinedAt).getTime()
        valB = new Date(b.joinedAt).getTime()
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [members, searchQuery, roleFilter, statusFilter, sortConfig])

  const filteredContributors = useMemo(() => {
    return contributors.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(contributorSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(contributorSearch.toLowerCase()) ||
        c.repositories.some((r) => r.toLowerCase().includes(contributorSearch.toLowerCase()))

      if (!matchesSearch) return false

      if (contributorFilter === 'UNINVITED') return !c.isMember && !c.isInvited
      if (contributorFilter === 'INVITED') return c.isInvited
      if (contributorFilter === 'MEMBER') return c.isMember
      return true
    })
  }, [contributors, contributorSearch, contributorFilter])

  // Handlers
  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole })
  }

  return (
    <div className="space-y-6">
      <QueryState isLoading={membersQuery.isLoading} error={membersQuery.error} onRetry={() => membersQuery.refetch()}>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total || 0}</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Members</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {members.filter((m) => m.status === 'ACTIVE' || (!m.status && m.role === 'OWNER')).length}
              </span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Active Accounts</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalUninvitedCount}</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Ready to Invite</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{invitations.length}</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Pending Invites</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{contributors.length}</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Discovered Authors</span>
            </CardContent>
          </Card>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-lg text-sm flex items-center gap-3 transition-all ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Organization Members</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {members.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contributors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'contributors'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitBranch className="h-4 w-4" />
            <span>Repository Contributors</span>
            {uninvitedContributors.length > 0 ? (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                {uninvitedContributors.length} new
              </span>
            ) : (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {contributors.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'invitations'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>Pending Invitations</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {invitations.length}
            </span>
          </button>
        </div>

        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" /> 
                  Organization Members
                </CardTitle>
                <CardDescription>Manage user roles, platform access, and invitations for {currentOrganization?.name}</CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {totalUninvitedCount > 0 && (
                  <Button
                    onClick={() => inviteAllMutation.mutate()}
                    isLoading={inviteAllMutation.isPending}
                    variant="outline"
                    className="gap-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  >
                    <Mail className="h-4 w-4" /> Invite All ({totalUninvitedCount})
                  </Button>
                )}
                <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" /> Invite New Member
                </Button>
              </div>
            </CardHeader>
            
            <div className="px-6 py-3 border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search members by name or email..." 
                  className="pl-9 bg-white dark:bg-slate-900"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="appearance-none h-10 px-3 pr-8 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Accounts</option>
                    <option value="INVITED">Invitation Pending</option>
                    <option value="UNINVITED">Not Invited</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
                    className="appearance-none h-10 px-3 pr-8 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                    <option value="TEAM_LEAD">Team Lead</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th 
                        className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">User <ArrowUpDown className="h-3 w-3" /></div>
                      </th>
                      <th 
                        className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => handleSort('role')}
                      >
                        <div className="flex items-center gap-1">Role <ArrowUpDown className="h-3 w-3" /></div>
                      </th>
                      <th className="px-6 py-3 font-medium">Status & Access</th>
                      <th 
                        className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:table-cell"
                        onClick={() => handleSort('joinedAt')}
                      >
                        <div className="flex items-center gap-1">Joined <ArrowUpDown className="h-3 w-3" /></div>
                      </th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAndSortedMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="text-base font-medium text-slate-700 dark:text-slate-300">No members found</p>
                          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredAndSortedMembers.map((member: OrganizationMember) => {
                        const isMemberActive = member.status === 'ACTIVE' || (!member.status && member.role === 'OWNER')
                        const isMemberInvited = member.status === 'INVITED'

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar name={member.user?.name || member.user?.email || 'User'} src={member.user?.avatarUrl} />
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{member.user?.name || 'Unnamed User'}</p>
                                  <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> {member.user?.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="outline" className={`${ROLE_COLORS[member.role].bg} ${ROLE_COLORS[member.role].text} ${ROLE_COLORS[member.role].border}`}>
                                {member.role}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              {isMemberActive ? (
                                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                  Active
                                </Badge>
                              ) : isMemberInvited ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                    Invitation Pending
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 px-2"
                                    onClick={() => resendInviteMutation.mutate(member.user.email)}
                                    isLoading={invitingEmail === member.user.email}
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" /> Resend
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                                    Not Invited
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/30 px-2"
                                    onClick={() => quickInviteMutation.mutate(member.user.email)}
                                    isLoading={invitingEmail === member.user.email}
                                  >
                                    <Mail className="h-3 w-3 mr-1" /> Send Invite
                                  </Button>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 hidden md:table-cell text-slate-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {new Date(member.joinedAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <select
                                  value={member.role}
                                  onChange={(e) => updateRoleMutation.mutate({ memberId: member.userId || member.id, role: e.target.value as UserRole })}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                  disabled={updateRoleMutation.isPending && (updateRoleMutation.variables?.memberId === member.id || updateRoleMutation.variables?.memberId === member.userId)}
                                >
                                  <option value="OWNER">Owner</option>
                                  <option value="ADMIN">Admin</option>
                                  <option value="TEAM_LEAD">Team Lead</option>
                                  <option value="DEVELOPER">Developer</option>
                                  <option value="VIEWER">Viewer</option>
                                </select>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 border-red-200 dark:border-red-900/50"
                                  onClick={() => setMemberToRemove(member.userId || member.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 2: DISCOVERED REPOSITORY CONTRIBUTORS */}
        {activeTab === 'contributors' && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-indigo-500" />
                  Repository Contributors & Developers
                </CardTitle>
                <CardDescription>
                  Discovered from commits in connected repositories. Send email invitations with one click so developers can join SQDIS.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {totalUninvitedCount > 0 && (
                  <Button
                    onClick={() => inviteAllMutation.mutate()}
                    isLoading={inviteAllMutation.isPending}
                    variant="outline"
                    className="gap-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  >
                    <Mail className="h-4 w-4" /> Invite All ({totalUninvitedCount})
                  </Button>
                )}
                <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" /> Invite by Custom Email
                </Button>
              </div>
            </CardHeader>

            <div className="px-6 py-3 border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search contributors by author name, email, or repository..."
                  className="pl-9 bg-white dark:bg-slate-900"
                  value={contributorSearch}
                  onChange={(e) => setContributorSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={contributorFilter}
                    onChange={(e) => setContributorFilter(e.target.value as any)}
                    className="appearance-none h-10 px-3 pr-8 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Contributors ({contributors.length})</option>
                    <option value="UNINVITED">Ready to Invite ({uninvitedContributors.length})</option>
                    <option value="INVITED">Invitation Sent ({contributors.filter(c => c.isInvited).length})</option>
                    <option value="MEMBER">Already Members ({contributors.filter(c => c.isMember).length})</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3 font-medium">Contributor</th>
                      <th className="px-6 py-3 font-medium">Connected Repositories</th>
                      <th className="px-6 py-3 font-medium">Commits & Activity</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Invitation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredContributors.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          <GitCommit className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="text-base font-medium text-slate-700 dark:text-slate-300">No contributors found</p>
                          <p className="text-sm mt-1">Connect repositories and ingest commits to discover author identities.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredContributors.map((c: RepositoryContributor) => (
                        <tr key={c.email} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={c.name} />
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {c.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {c.repositories.map((repo) => (
                                <Badge key={repo} variant="outline" className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                  {repo}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            <div className="space-y-0.5">
                              <div className="font-medium text-xs flex items-center gap-1.5">
                                <GitCommit className="h-3.5 w-3.5 text-blue-500" />
                                {c.commitCount} {c.commitCount === 1 ? 'commit' : 'commits'}
                              </div>
                              {c.lastCommittedAt && (
                                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Last: {new Date(c.lastCommittedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {c.isMember ? (
                              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                Member ({c.memberRole || 'ACTIVE'})
                              </Badge>
                            ) : c.isInvited ? (
                              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                Invitation Pending
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                                Not Invited
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {c.isMember ? (
                              <span className="text-xs text-slate-400 font-medium">Joined Organization</span>
                            ) : c.isInvited ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1"
                                onClick={() => resendInviteMutation.mutate(c.email)}
                                isLoading={invitingEmail === c.email}
                              >
                                <RefreshCw className="h-3 w-3" /> Resend Invite
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm"
                                onClick={() => quickInviteMutation.mutate(c.email)}
                                isLoading={invitingEmail === c.email}
                              >
                                <UserPlus className="h-3.5 w-3.5" /> Send Invite
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 3: PENDING INVITATIONS */}
        {activeTab === 'invitations' && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-purple-500" />
                  Pending Organization Invitations
                </CardTitle>
                <CardDescription>
                  Track outgoing email invitations and expiration dates for {currentOrganization?.name}.
                </CardDescription>
              </div>
              <Button onClick={() => setIsInviteOpen(true)} className="gap-2 shrink-0">
                <UserPlus className="h-4 w-4" /> Send New Invitation
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3 font-medium">Invited Email</th>
                      <th className="px-6 py-3 font-medium">Sent Date</th>
                      <th className="px-6 py-3 font-medium">Expires At</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invitations.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="text-base font-medium text-slate-700 dark:text-slate-300">No active pending invitations</p>
                          <p className="text-sm mt-1">Invite team members or repository contributors to collaborate.</p>
                        </td>
                      </tr>
                    ) : (
                      invitations.map((inv: Invitation) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                              <Mail className="h-4 w-4 text-slate-400" />
                              {inv.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 hover:text-blue-700 border-blue-200 gap-1"
                                onClick={() => resendInviteMutation.mutate(inv.email)}
                                isLoading={invitingEmail === inv.email}
                              >
                                <RefreshCw className="h-3 w-3" /> Resend
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                onClick={() => revokeInviteMutation.mutate(inv.id)}
                                isLoading={revokeInviteMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

      </QueryState>

      {/* Invite Modal */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite New Member">
        <form onSubmit={handleInvite} className="space-y-5">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-800 dark:text-blue-300 flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <p>
              Invited developers will receive an email with an invitation link to open an account or join your workspace.
            </p>
          </div>

          {/* Quick select chips for discovered repository contributors */}
          {uninvitedContributors.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Quick-select from discovered repository contributors:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                {uninvitedContributors.map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => setInviteEmail(c.email)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all border ${
                      inviteEmail === c.email
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <GitCommit className="h-3 w-3" />
                    <span>{c.name}</span>
                    <span className="opacity-60 text-[10px]">({c.email})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Initial Role</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {(['ADMIN', 'TEAM_LEAD', 'DEVELOPER', 'VIEWER'] as UserRole[]).map((role) => (
                <div 
                  key={role}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    inviteRole === role
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                  onClick={() => setInviteRole(role)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{role.replace('_', ' ')}</span>
                    {inviteRole === role && <Check className="h-4 w-4 text-blue-500" />}
                  </div>
                  <p className="text-xs text-slate-500">
                    {role === 'ADMIN' && 'Full access except billing.'}
                    {role === 'TEAM_LEAD' && 'Can manage teams and projects.'}
                    {role === 'DEVELOPER' && 'Can contribute to assigned projects.'}
                    {role === 'VIEWER' && 'Read-only access to organization.'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={inviteMutation.isPending} disabled={!currentOrganization || !inviteEmail.trim()}>
              Send Invitation Email
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Remove Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => memberToRemove && removeMemberMutation.mutate(memberToRemove)}
        title="Remove Member"
        description="Are you sure you want to remove this member from the organization? They will lose access to all repositories and teams."
        confirmText="Remove Member"
        confirmVariant="destructive"
        isLoading={removeMemberMutation.isPending}
      />
    </div>
  )
}
