import { useActiveRepository } from '@/hooks/useActiveRepository'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/dropdown'
import { GitBranch, Check, ChevronDown, Plus, ExternalLink, Layers } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'

export function RepositorySelector() {
  const {
    activeRepoId,
    activeRepo,
    repositories,
    setActiveRepoId,
    isLoading,
    hasRepositories,
  } = useActiveRepository()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="h-8 w-36 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    )
  }

  if (!hasRepositories) {
    return (
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Plus className="h-3.5 w-3.5 text-slate-500" />
        <span>Connect Repo</span>
      </button>
    )
  }

  const displayName = activeRepo?.fullName || activeRepo?.name || 'All Repositories'

  return (
    <Dropdown
      trigger={
        <button
          className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
          title={`Active Repository: ${displayName}`}
        >
          <GitBranch className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="max-w-[130px] sm:max-w-[180px] md:max-w-[220px] truncate text-left">
            {displayName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </button>
      }
      className="w-72"
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span>Repositories</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {repositories.length}
        </Badge>
      </div>

      <div className="max-h-64 overflow-y-auto">
        <DropdownItem
          onClick={() => setActiveRepoId('')}
          className={!activeRepoId ? 'bg-emerald-50/70 dark:bg-emerald-950/30 font-medium' : ''}
        >
          <div className="flex items-center justify-between w-full min-w-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers
                className={`h-3.5 w-3.5 shrink-0 ${
                  !activeRepoId
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400'
                }`}
              />
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-900 dark:text-slate-100 font-medium">
                  All Repositories
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  Portfolio overview across all projects
                </p>
              </div>
            </div>

            {!activeRepoId && (
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
            )}
          </div>
        </DropdownItem>

        <DropdownDivider />

        {repositories.map((repo) => {
          const isSelected = repo.id === activeRepoId
          return (
            <DropdownItem
              key={repo.id}
              onClick={() => setActiveRepoId(repo.id)}
              className={isSelected ? 'bg-emerald-50/70 dark:bg-emerald-950/30 font-medium' : ''}
            >
              <div className="flex items-center justify-between w-full min-w-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GitBranch
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isSelected
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-900 dark:text-slate-100 font-medium">
                      {repo.fullName || repo.name}
                    </p>
                    {repo.defaultBranch && (
                      <p className="text-[10px] text-slate-400 truncate">
                        branch: {repo.defaultBranch}
                      </p>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                )}
              </div>
            </DropdownItem>
          )
        })}
      </div>

      <DropdownDivider />

      <DropdownItem
        icon={<ExternalLink className="h-3.5 w-3.5" />}
        onClick={() => navigate('/settings')}
        className="text-xs text-slate-500 dark:text-slate-400"
      >
        Manage Repositories
      </DropdownItem>
    </Dropdown>
  )
}
