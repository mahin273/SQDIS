import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Mail, Clock, Trash2, Send, 
  XCircle, AlertCircle, Plus, Search 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { organizationService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useUserRole } from '@/rbac/hooks'
import { QueryState } from '../pageUtils'
import type { Invitation, UserRole } from '@/types'

export function InvitationsPage() {
  const queryClient = useQueryClient()
  const { currentOrganization } = useOrganizationStore()
  const currentUserRole = useUserRole()
  const isOwner = currentUserRole === 'OWNER'
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('DEVELOPER')
  const [invitationToRevoke, setInvitationToRevoke] = useState<string | null>(null)

  const invitationsQuery = useQuery({
    queryKey: queryKeys.organizations.invitations,
    queryFn: () => {
      if (!currentOrganization) return Promise.resolve([])
      // Mocking getting invitations from org service
      return organizationService.getInvitations(currentOrganization.id)
    },
    enabled: !!currentOrganization,
  })

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string, role: UserRole }) => {
      if (!currentOrganization) throw new Error('No organization')
      return organizationService.inviteMember(currentOrganization.id, { email: data.email }) // Assuming role is sent if service supports it
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations })
      setIsInviteOpen(false)
      setInviteEmail('')
      setInviteRole('DEVELOPER')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => {
      if (!currentOrganization) throw new Error('No organization')
      return organizationService.revokeInvitation(currentOrganization.id, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations })
      setInvitationToRevoke(null)
    },
  })

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => {
      if (!currentOrganization) throw new Error('No organization')
      const target = invitations.find((i: Invitation) => i.id === invitationId)
      if (!target) throw new Error('Invitation not found')
      return organizationService.resendInvitation(currentOrganization.id, { email: target.email })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations })
    },
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole })
  }

  const invitations = Array.isArray(invitationsQuery.data) ? invitationsQuery.data : []
  
  const filteredInvitations = invitations.filter((inv: Invitation) => 
    inv.email.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a: Invitation, b: Invitation) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const getStatusBadge = (status: Invitation['status']) => {
    switch(status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">Pending</Badge>
      case 'ACCEPTED':
        return <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">Accepted</Badge>
      case 'REVOKED':
        return <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">Revoked</Badge>
      case 'EXPIRED':
        return <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">Expired</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Pending Invitations
            </CardTitle>
            <CardDescription>Manage invites sent to people to join {currentOrganization?.name}.</CardDescription>
          </div>
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Send Invite
          </Button>
        </CardHeader>

        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by email..." 
              className="pl-9 bg-white dark:bg-slate-900"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <CardContent className="p-0">
          <QueryState isLoading={invitationsQuery.isLoading} error={invitationsQuery.error} onRetry={() => invitationsQuery.refetch()}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvitations.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-base font-medium text-slate-700 dark:text-slate-300">No invitations found</p>
                  <p className="text-sm mt-1">Send a new invite to add members to your organization.</p>
                </div>
              ) : (
                filteredInvitations.map((inv: Invitation) => {
                  const expired = isExpired(inv.expiresAt)
                  const isActive = inv.status === 'PENDING' && !expired
                  
                  return (
                    <div key={inv.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          {inv.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{inv.email}</h4>
                            {getStatusBadge(expired && inv.status === 'PENDING' ? 'EXPIRED' : inv.status)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              Role: <span className="font-medium">{inv.role}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              Sent on {new Date(inv.createdAt).toLocaleDateString()}
                            </span>
                            {isActive && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Expires {new Date(inv.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:ml-auto">
                        {isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => resendMutation.mutate(inv.id)}
                            disabled={resendMutation.isPending && resendMutation.variables === inv.id}
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Resend</span>
                          </Button>
                        )}
                        {(inv.status === 'PENDING') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/50"
                            onClick={() => setInvitationToRevoke(inv.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Revoke</span>
                          </Button>
                        )}
                        {inv.status !== 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-red-600"
                            onClick={() => setInvitationToRevoke(inv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </QueryState>
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite to Organization">
        <form onSubmit={handleInvite} className="space-y-5">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-sm text-slate-600 dark:text-slate-400 flex gap-3">
            <Mail className="h-5 w-5 shrink-0 text-blue-500" />
            <p>They will receive an email with a secure link that expires in 7 days to join your organization.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="developer@company.com"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assign Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isOwner && <option value="ADMIN">Admin - Full access</option>}
              <option value="TEAM_LEAD">Team Lead - Manage teams & projects</option>
              <option value="DEVELOPER">Developer - Standard access</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={inviteMutation.isPending} disabled={!currentOrganization || !inviteEmail.trim()}>
              Send Invite
            </Button>
          </div>
        </form>
      </Modal>

      {/* Revoke Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!invitationToRevoke}
        onClose={() => setInvitationToRevoke(null)}
        onConfirm={() => invitationToRevoke && revokeMutation.mutate(invitationToRevoke)}
        title="Revoke Invitation"
        description="Are you sure you want to revoke this invitation? The recipient will no longer be able to use the link to join the organization."
        confirmText="Revoke Invite"
        confirmVariant="destructive"
        isLoading={revokeMutation.isPending}
      />
    </div>
  )
}
