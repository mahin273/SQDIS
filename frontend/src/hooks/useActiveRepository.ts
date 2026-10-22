import { useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { repositoriesService } from '@/services/repositories.service'
import { useRepositoryStore } from '@/stores/repositoryStore'
import type { Repository } from '@/types'

export interface UseActiveRepositoryOptions {
  /**
   * If true, forces a repository selection (falling back to the first available repository
   * if none is currently selected in the URL or store).
   * If false, allows an empty selection ('') representing "All Repositories".
   * Defaults to false.
   */
  requireSelection?: boolean
}

export function useActiveRepository(options: UseActiveRepositoryOptions = {}) {
  const { requireSelection = false } = options
  const [searchParams, setSearchParams] = useSearchParams()
  const urlRepoId = searchParams.get('repo')
  const pendingSwitchRef = useRef<string | null>(null)

  const {
    activeRepositoryId,
    setActiveRepositoryId,
    setRepositories,
  } = useRepositoryStore()

  // Fetch connected repositories with React Query
  const { data: repositories = [], isLoading, error } = useQuery<Repository[]>({
    queryKey: ['repositories', 'connected'],
    queryFn: () => repositoriesService.getConnected(),
    staleTime: 60 * 1000,
  })

  // Synchronize query results with store
  useEffect(() => {
    if (repositories.length > 0) {
      setRepositories(repositories)
    }
  }, [repositories, setRepositories])

  // Resolve effective active repository ID
  const effectiveRepoId = useMemo(() => {
    // If a manual switch is in-flight, honor the pending target selection
    if (pendingSwitchRef.current !== null) {
      return pendingSwitchRef.current
    }

    // 1. URL search parameter if present
    if (urlRepoId) {
      // While loading, preserve URL param as candidate
      if (isLoading || repositories.some((r) => r.id === urlRepoId)) {
        return urlRepoId
      }
    }
    // 2. Zustand store active ID if valid
    if (activeRepositoryId) {
      if (isLoading || repositories.some((r) => r.id === activeRepositoryId)) {
        return activeRepositoryId
      }
    }
    // 3. Fallback to first available repository only if selection is strictly required
    if (requireSelection && repositories.length > 0) {
      return repositories[0].id
    }
    // 4. Default to empty string representing All Repositories
    return ''
  }, [urlRepoId, activeRepositoryId, repositories, requireSelection, isLoading])

  // Synchronize store and URL search params
  useEffect(() => {
    // Never mutate store or URL search params while query is still loading
    if (isLoading) return

    // If pending switch target is now reflected in the URL search params, clear pending state
    if (pendingSwitchRef.current !== null) {
      const currentParam = searchParams.get('repo') || ''
      if (currentParam === pendingSwitchRef.current) {
        pendingSwitchRef.current = null
      }
    }

    // Update store if desynchronized
    const targetStoreId = effectiveRepoId || null
    if (activeRepositoryId !== targetStoreId) {
      setActiveRepositoryId(targetStoreId)
    }

    // Update URL param if desynchronized without adding a new history entry
    const currentUrlParam = searchParams.get('repo')
    const needsParamUpdate = effectiveRepoId
      ? currentUrlParam !== effectiveRepoId
      : searchParams.has('repo')

    if (needsParamUpdate) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (effectiveRepoId) {
            next.set('repo', effectiveRepoId)
          } else {
            next.delete('repo')
          }
          return next
        },
        { replace: true }
      )
    }
  }, [
    effectiveRepoId,
    activeRepositoryId,
    searchParams,
    setActiveRepositoryId,
    setSearchParams,
    isLoading,
  ])

  // Switch repository handler
  const setActiveRepoId = useCallback(
    (repoId: string | null) => {
      const normalizedId = repoId || ''
      pendingSwitchRef.current = normalizedId
      setActiveRepositoryId(normalizedId ? normalizedId : null)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (normalizedId) {
            next.set('repo', normalizedId)
          } else {
            next.delete('repo')
          }
          return next
        },
        { replace: true }
      )
    },
    [setActiveRepositoryId, setSearchParams]
  )

  const activeRepo = useMemo(() => {
    return repositories.find((r) => r.id === effectiveRepoId) || null
  }, [repositories, effectiveRepoId])

  return {
    activeRepoId: effectiveRepoId,
    activeRepo,
    repositories,
    setActiveRepoId,
    isLoading,
    error,
    hasRepositories: repositories.length > 0,
  }
}
