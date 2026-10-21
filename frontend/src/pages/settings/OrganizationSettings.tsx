import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Building, Save, 
  AlertOctagon, Clock, Globe, GitBranch, Users, 
  Copy, CheckCheck, Shield, Info, CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { organizationService, repositoriesService, membersService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useAuthStore } from '@/stores/authStore'
import type { UpdateOrganizationRequest, Repository, OrganizationMember } from '@/types'

export function OrganizationSettings() {
  const queryClient = useQueryClient()
  const { currentOrganization, setCurrentOrganization } = useOrganizationStore()
  const { user } = useAuthStore()
  
  const [formData, setFormData] = useState<UpdateOrganizationRequest>({
    name: currentOrganization?.name || '',
    slug: currentOrganization?.slug || '',
    logoUrl: currentOrganization?.logoUrl || '',
  })
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [copiedOrgId, setCopiedOrgId] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Fetch live organization statistics
  const reposQuery = useQuery({
    queryKey: queryKeys.repositories.all(),
    queryFn: () => repositoriesService.getAll(),
    enabled: !!currentOrganization,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.members.all(),
    queryFn: () => membersService.getAll(),
    enabled: !!currentOrganization,
  })

  // Normalize repositories count
  const rawRepos = reposQuery.data
  const repos: Repository[] = Array.isArray(rawRepos)
    ? rawRepos
    : (rawRepos && typeof rawRepos === 'object' && Array.isArray((rawRepos as any).data))
    ? (rawRepos as any).data
    : (rawRepos && typeof rawRepos === 'object' && Array.isArray((rawRepos as any).repositories))
    ? (rawRepos as any).repositories
    : []

  // Normalize members count
  const rawMembers = membersQuery.data
  const members: OrganizationMember[] = Array.isArray(rawMembers)
    ? rawMembers
    : (rawMembers && typeof rawMembers === 'object' && Array.isArray((rawMembers as any).data))
    ? (rawMembers as any).data
    : (rawMembers && typeof rawMembers === 'object' && Array.isArray((rawMembers as any).members))
    ? (rawMembers as any).members
    : []

  // Check current user role
  const currentUserMembership = members.find((m) => m.userId === user?.id)
  const isOwner = currentUserMembership?.role === 'OWNER'
  const isAdmin = currentUserMembership?.role === 'ADMIN' || isOwner

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => {
      if (!currentOrganization) throw new Error('No organization')
      return organizationService.update(currentOrganization.id, data)
    },
    onSuccess: (updatedOrg) => {
      if (updatedOrg) {
        setCurrentOrganization(updatedOrg)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!currentOrganization) throw new Error('No organization')
      return organizationService.delete(currentOrganization.id)
    },
    onSuccess: () => {
      window.location.href = '/'
    },
  })

  if (!currentOrganization) {
    return (
      <div className="p-8 text-center border rounded-lg bg-slate-50 dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700">
        <Building className="h-10 w-10 mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">No Organization Selected</h3>
        <p className="text-slate-500 mt-1">Please select an organization to view its administrative settings.</p>
      </div>
    )
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  const copyOrgId = () => {
    if (currentOrganization?.id) {
      navigator.clipboard.writeText(currentOrganization.id)
      setCopiedOrgId(true)
      setTimeout(() => setCopiedOrgId(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Workspace Operational Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Connected Repositories</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {reposQuery.isLoading ? '...' : repos.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tracked for SQS quality</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Organization Seats</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {membersQuery.isLoading ? '...' : members.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Active engineers & admins</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Access Tier</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">Enterprise</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Unlimited Codebases</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Established</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {currentOrganization.createdAt ? new Date(currentOrganization.createdAt).toLocaleDateString() : 'N/A'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Active workspace</p>
            </div>
          </div>
        </Card>

      </div>

      {/* Role Notice */}
      {!isAdmin && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg flex items-center gap-3 text-blue-900 dark:text-blue-200 text-xs">
          <Info className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            You are viewing organization parameters with a <strong>{currentUserMembership?.role || 'DEVELOPER'}</strong> role. Only workspace Owners and Administrators can modify core profile settings.
          </span>
        </div>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">General Workspace Identity</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Update your organization identity, public slug, and branding assets.
                </CardDescription>
              </div>
            </div>
            {saveSuccess && (
              <Badge variant="success" className="gap-1.5 py-1 px-2.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </Badge>
            )}
          </div>
        </CardHeader>

        <form onSubmit={handleUpdate}>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row gap-8">
              
              {/* Logo Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="h-24 w-24 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden relative group">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Organization Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Building className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Workspace Brand</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">128x128px recommended</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="flex-1 space-y-4">
                <div className="grid gap-1.5">
                  <label htmlFor="org-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Organization Name
                  </label>
                  <Input 
                    id="org-name"
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Acme Corporation"
                    disabled={!isAdmin}
                    className="max-w-md bg-white dark:bg-slate-900"
                  />
                </div>
                
                <div className="grid gap-1.5">
                  <label htmlFor="org-slug" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Routing Slug
                  </label>
                  <div className="flex items-center max-w-md">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-xs h-9 dark:bg-slate-800 dark:border-slate-700">
                      sqdis.app/
                    </span>
                    <Input 
                      id="org-slug"
                      value={formData.slug} 
                      onChange={e => setFormData({ ...formData, slug: e.target.value })}
                      disabled={!isAdmin}
                      className="rounded-l-none bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Unique workspace URL identifier (lowercase letters, numbers, and hyphens only).
                  </p>
                </div>
                
                <div className="grid gap-1.5">
                  <label htmlFor="org-logo" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Logo Image URL (Optional)
                  </label>
                  <Input 
                    id="org-logo"
                    value={formData.logoUrl || ''} 
                    onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    disabled={!isAdmin}
                    className="max-w-md bg-white dark:bg-slate-900 text-xs"
                  />
                </div>

                <div className="grid gap-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Workspace Identifier (UUID)
                  </label>
                  <div className="flex items-center gap-2 max-w-md">
                    <Input 
                      value={currentOrganization.id} 
                      readOnly 
                      disabled 
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-900 text-slate-500"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={copyOrgId}
                      className="shrink-0 gap-1.5"
                    >
                      {copiedOrgId ? (
                        <>
                          <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-xs">Copy ID</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 py-3.5 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Workspace created on {currentOrganization.createdAt ? new Date(currentOrganization.createdAt).toLocaleDateString() : 'N/A'}
            </span>
            {isAdmin && (
              <Button type="submit" isLoading={updateMutation.isPending} className="gap-2">
                <Save className="h-4 w-4" /> Save Workspace Profile
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>

      {/* Subscription & Enterprise Allocation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Subscription & Infrastructure Capacity</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Resource quotas and quality analytics pipeline tier.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-5 border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-900/10 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Enterprise Plan</h3>
                <Badge variant="success" className="text-xs">Active</Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                Unlimited GitHub codebases, real-time SQS calculation, AST Tree-sitter defect prediction, and BullMQ report generation.
              </p>
              <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Codebases: <strong>{repos.length} Connected</strong></span>
                <span>•</span>
                <span>Team Seats: <strong>{members.length} Provisioned</strong></span>
                <span>•</span>
                <span>Quality Gate Engine: <strong>Automated Bot Active</strong></span>
              </div>
            </div>
            <div className="shrink-0 flex gap-2">
              <Badge variant="outline" className="bg-white dark:bg-slate-900 text-xs px-3 py-1.5 border-emerald-300 dark:border-emerald-800">
                Enterprise SLA
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isOwner && (
        <Card className="border-red-200 dark:border-red-900/50 overflow-hidden">
          <CardHeader className="bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/50">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertOctagon className="h-5 w-5" />
              <CardTitle className="text-base font-semibold">Danger Zone</CardTitle>
            </div>
            <CardDescription className="text-xs text-red-600/80 dark:text-red-400/80">
              Irreversible actions affecting the entire organization workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Delete Organization</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                  Permanently delete <span className="font-semibold text-slate-700 dark:text-slate-300">{currentOrganization.name}</span>, including all repositories, code quality telemetry, AST metrics, and member access. This action cannot be reversed.
                </p>
              </div>
              <Button 
                variant="destructive" 
                className="shrink-0 gap-1.5"
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                <AlertOctagon className="h-4 w-4" /> Delete Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false)
          setDeleteConfirmText('')
        }}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Organization"
        description={
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-300 text-sm">
              This will permanently delete <span className="font-bold text-slate-900 dark:text-white">{currentOrganization.name}</span> and all associated quality metrics. This action is irreversible.
            </p>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded text-xs border border-red-100 dark:border-red-800/30">
              <p className="font-semibold mb-1">Please type the organization name to confirm:</p>
              <Input 
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={currentOrganization.name}
                className="mt-2 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>
        }
        confirmText="Yes, delete organization"
        confirmVariant="destructive"
        isLoading={deleteMutation.isPending}
        isConfirmDisabled={deleteConfirmText !== currentOrganization.name}
      />

    </div>
  )
}
