import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  HelpCircle, Search, 
  Calendar, ChevronDown, CheckCircle2, X, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { emailAliasesService, membersService, commitsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { useOrganizationStore } from '@/stores/organizationStore'
import { QueryState } from '../pageUtils'
import type { UnmappedEmail, OrganizationMember } from '@/types'

export function UnmappedEmailsPage() {
  const queryClient = useQueryClient()
  const { currentOrganization } = useOrganizationStore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])

  const unmappedEmailsQuery = useQuery({
    queryKey: ['unmapped-emails', currentOrganization?.id],
    queryFn: () => emailAliasesService.getUnmappedEmails(),
    enabled: !!currentOrganization,
  })

  // We need to list all members to map them to
  const membersQuery = useQuery({
    queryKey: queryKeys.members.all(),
    queryFn: () => membersService.getAll(),
  })

  // Mutations
  const reattributeMutation = useMutation({
    mutationFn: () => commitsService.reattribute(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['unmapped-emails', currentOrganization?.id] })
      queryClient.invalidateQueries({ queryKey: queryKeys.commits.all() })
      toast(`Successfully re-attributed ${res?.updated ?? 0} commit(s) across ${res?.developersDiscovered ?? 0} developer(s).`, { type: 'success' })
    },
    onError: (err: any) => {
      toast(err?.response?.data?.message || err?.message || 'Failed to re-attribute commits', { type: 'error' })
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ email, userId }: { email: string; userId: string }) => {
      return emailAliasesService.assignEmail({ email, userId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmapped-emails', currentOrganization?.id] })
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      setSelectedEmails([])
    },
  })

  const ignoreMutation = useMutation({
    mutationFn: (email: string) => {
      // Filter out locally if ignored
      return Promise.resolve(email)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmapped-emails', currentOrganization?.id] })
    },
  })

  const unmappedEmails = Array.isArray(unmappedEmailsQuery.data) ? unmappedEmailsQuery.data : []
  const rawMembers = membersQuery.data
  const members = Array.isArray(rawMembers)
    ? rawMembers
    : (rawMembers && typeof rawMembers === 'object' && Array.isArray((rawMembers as any).data))
    ? (rawMembers as any).data
    : (rawMembers && typeof rawMembers === 'object' && Array.isArray((rawMembers as any).members))
    ? (rawMembers as any).members
    : []

  const filteredEmails = useMemo(() => {
    return unmappedEmails.filter(item => 
      item.email.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => b.commitCount - a.commitCount)
  }, [unmappedEmails, searchQuery])

  const toggleSelection = (email: string) => {
    setSelectedEmails(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const toggleAll = () => {
    if (selectedEmails.length === filteredEmails.length) {
      setSelectedEmails([])
    } else {
      setSelectedEmails(filteredEmails.map(e => e.email))
    }
  }

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-orange-500" />
            Unmapped Commit Emails
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            These email addresses were found in your repository history but aren't mapped to any active SQDIS user.
          </p>
        </div>
        <Button
          onClick={() => reattributeMutation.mutate()}
          disabled={reattributeMutation.isPending}
          className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <RefreshCw className={`h-4 w-4 ${reattributeMutation.isPending ? 'animate-spin' : ''}`} />
          {reattributeMutation.isPending ? 'Re-attributing...' : 'Re-attribute Commits'}
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search unmapped emails or names..." 
              className="pl-9 bg-white dark:bg-slate-900"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {selectedEmails.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {selectedEmails.length} selected
              </span>
              <Button size="sm" variant="outline" className="text-slate-500" onClick={() => setSelectedEmails([])}>
                Clear
              </Button>
            </div>
          )}
        </div>

        <CardContent className="p-0">
          <QueryState isLoading={unmappedEmailsQuery.isLoading} error={unmappedEmailsQuery.error} onRetry={() => unmappedEmailsQuery.refetch()}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={filteredEmails.length > 0 && selectedEmails.length === filteredEmails.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-6 py-3 font-medium">Git Author & Email</th>
                    <th className="px-6 py-3 font-medium text-center">Commits</th>
                    <th className="px-6 py-3 font-medium hidden md:table-cell">Last Seen</th>
                    <th className="px-6 py-3 font-medium text-right">Assign To User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEmails.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500/50" />
                        <p className="text-base font-medium text-slate-700 dark:text-slate-300">All caught up!</p>
                        <p className="text-sm mt-1">There are no unmapped commit emails in your repositories.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEmails.map((item: UnmappedEmail) => {
                      const initial = (item.email || 'U').charAt(0).toUpperCase();
                      const lastSeenDate = item.lastSeenAt || item.firstSeenAt;
                      return (
                        <tr key={item.id || item.email} className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors ${selectedEmails.includes(item.email) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={selectedEmails.includes(item.email)}
                              onChange={() => toggleSelection(item.email)}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 font-medium">
                                {initial}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100 font-mono text-sm">{item.email}</p>
                                <p className="text-xs text-slate-500">Unassigned author</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge variant="secondary" className="font-mono">{item.commitCount ?? 0}</Badge>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell text-slate-500 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {lastSeenDate ? new Date(lastSeenDate).toLocaleDateString() : 'Recent'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="relative inline-block text-left">
                              <select 
                                className="appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignMutation.mutate({ email: item.email, userId: e.target.value })
                                  }
                                }}
                                disabled={assignMutation.isPending}
                                defaultValue=""
                              >
                                <option value="" disabled>Assign to...</option>
                                {members.map((m: OrganizationMember) => (
                                  <option key={m.id} value={m.userId}>
                                    {m.user?.name || m.user?.email}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2.5 top-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              title="Ignore Email"
                              onClick={() => ignoreMutation.mutate(item.email)}
                              disabled={ignoreMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  )
}
