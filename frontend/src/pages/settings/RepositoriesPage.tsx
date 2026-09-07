import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  GitBranch, RefreshCw, Search, ToggleLeft, ToggleRight,
  Shield, Clock, ExternalLink, GitCommit, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { repositoriesService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { QueryState } from '../pageUtils'
import type { Repository } from '@/types'

export function RepositoriesPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  const reposQuery = useQuery({
    queryKey: queryKeys.repositories.all(),
    queryFn: () => repositoriesService.getAll(),
  })

  // Mutations
  const toggleRepoMutation = useMutation({
    mutationFn: ({ repo, enabled }: { repo: Repository; enabled: boolean }) => 
      repositoriesService.toggle(repo, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.github.status })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats })
    },
  })

  const syncRepoMutation = useMutation({
    mutationFn: (id: string) => repositoriesService.sync(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
    },
  })

  const syncAllMutation = useMutation({
    mutationFn: () => repositoriesService.syncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
    },
  })

  const rawRepos = reposQuery.data
  const repositories: Repository[] = Array.isArray(rawRepos)
    ? rawRepos
    : (rawRepos && typeof rawRepos === 'object' && Array.isArray((rawRepos as any).data))
    ? (rawRepos as any).data
    : (rawRepos && typeof rawRepos === 'object' && Array.isArray((rawRepos as any).repositories))
    ? (rawRepos as any).repositories
    : []

  const filteredRepos = useMemo(() => {
    return repositories.map((r: any) => ({
      ...r,
      isActive: r.isActive ?? r.isEnabled ?? false,
      url: r.url || (r.fullName ? `https://github.com/${r.fullName}` : undefined),
    })).filter((repo: Repository) => 
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a: Repository, b: Repository) => {
      // Sort by active first, then name
      if (a.isActive && !b.isActive) return -1
      if (!a.isActive && b.isActive) return 1
      return a.name.localeCompare(b.name)
    })
  }, [repositories, searchQuery])

  const activeCount = repositories.filter((r: any) => r.isActive ?? r.isEnabled ?? false).length

  return (
    <div className="space-y-6">
      <QueryState isLoading={reposQuery.isLoading} error={reposQuery.error} onRetry={() => reposQuery.refetch()}>
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{repositories.length}</span>
              <span className="text-sm font-medium text-slate-500 mt-1">Total Repositories</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
              <span className="text-sm font-medium text-slate-500 mt-1">Active (Syncing)</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-3xl font-bold text-slate-400 dark:text-slate-500">{repositories.length - activeCount}</span>
              <span className="text-sm font-medium text-slate-500 mt-1">Inactive</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-blue-500" />
                Connected Repositories
              </CardTitle>
              <CardDescription>Manage which repositories are actively analyzed and synced.</CardDescription>
            </div>
            <Button 
              onClick={() => syncAllMutation.mutate()} 
              isLoading={syncAllMutation.isPending}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} /> 
              Sync All Active
            </Button>
          </CardHeader>
          
          <div className="px-6 py-3 border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search repositories..." 
                className="pl-9 bg-white dark:bg-slate-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRepos.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-base font-medium text-slate-700 dark:text-slate-300">No repositories found</p>
                  <p className="text-sm mt-1">Try adjusting your search query.</p>
                </div>
              ) : (
                filteredRepos.map((repo: Repository) => {
                  const targetIdentifier = repo.id || (repo.githubId ? repo.githubId.toString() : repo.name)
                  const isTogglingThis = toggleRepoMutation.isPending && (
                    toggleRepoMutation.variables?.repo.id === repo.id ||
                    toggleRepoMutation.variables?.repo.githubId === repo.githubId ||
                    toggleRepoMutation.variables?.repo.name === repo.name
                  )

                  return (
                    <div key={repo.id || repo.githubId || repo.name} className={`p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${repo.isActive ? 'hover:bg-slate-50 dark:hover:bg-slate-900/50' : 'bg-slate-50/50 dark:bg-slate-900/20 opacity-80'}`}>
                      
                      {/* Repo Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {repo.fullName || repo.name}
                          </h4>
                          {!repo.isActive && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>
                          )}
                          {repo.isPrivate && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:bg-amber-900/20">Private</Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 mt-2">
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3.5 w-3.5" /> {repo.defaultBranch || 'main'}
                          </span>
                          
                          {repo.isActive ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Active & Syncing
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> Sync Disabled
                            </span>
                          )}
                          
                          {repo.lastSyncAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> 
                              Synced {new Date(repo.lastSyncAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats & Actions */}
                      <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
                        
                        {repo.isActive && (
                          <div className="flex items-center gap-6 hidden sm:flex">
                            <div className="text-center">
                              <p className="text-xs text-slate-500 mb-0.5">Commits</p>
                              <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 justify-center">
                                <GitCommit className="h-3 w-3" />
                                {repo.commitCount || 0}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-500 mb-0.5">Quality Score</p>
                              <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 justify-center">
                                <Shield className="h-3 w-3" />
                                {repo.sqsScore ? `${repo.sqsScore}/100` : 'N/A'}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Sync Repository"
                            disabled={!repo.isActive || (syncRepoMutation.isPending && syncRepoMutation.variables === targetIdentifier)}
                            onClick={() => syncRepoMutation.mutate(targetIdentifier)}
                          >
                            <RefreshCw className={`h-4 w-4 ${syncRepoMutation.isPending && syncRepoMutation.variables === targetIdentifier ? 'animate-spin' : ''}`} />
                          </Button>
                          
                          {repo.url && (
                            <Button variant="ghost" size="icon" asChild title="View on GitHub">
                              <a href={repo.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          
                          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                          
                          <button
                            onClick={() => toggleRepoMutation.mutate({ repo, enabled: !repo.isActive })}
                            disabled={isTogglingThis}
                            className={`flex items-center gap-2 text-sm font-medium transition-colors px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              repo.isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                          >
                            {isTogglingThis ? (
                              <>
                                <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                                <span className="text-xs">{repo.isActive ? 'Disabling...' : 'Enabling...'}</span>
                              </>
                            ) : repo.isActive ? (
                              <><ToggleRight className="h-7 w-7 text-blue-500" /> Active</>
                            ) : (
                              <><ToggleLeft className="h-7 w-7 text-slate-400" /> Inactive</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </QueryState>
    </div>
  )
}
