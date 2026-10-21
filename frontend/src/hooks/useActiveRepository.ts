import { useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { repositoriesService } from '@/services/repositories.service'
import { useRepositoryStore } from '@/stores/repositoryStore'
import type { Repository } from '@/types'

export function useActiveRepository() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlRepoId = searchParams.get('repo')

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
    // 1. URL search parameter if present and valid
    if (urlRepoId && repositories.some((r) => r.id === urlRepoId)) {
      return urlRepoId
    }
    // 2. Zustand store active ID if valid
    if (activeRepositoryId && repositories.some((r) => r.id === activeRepositoryId)) {
      return activeRepositoryId
    }
    // 3. Fallback to first available repository
    return repositories[0]?.id || ''
  }, [urlRepoId, activeRepositoryId, repositories])

  // Synchronize store and URL search params
  useEffect(() => {
    if (!effectiveRepoId) return

    // Update store if desynchronized
    if (activeRepositoryId !== effectiveRepoId) {
      setActiveRepositoryId(effectiveRepoId)
    }

    // Update URL param if desynchronized without adding a new history entry
    if (urlRepoId !== effectiveRepoId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('repo', effectiveRepoId)
          return next
        },
        { replace: true }
      )
    }
  }, [effectiveRepoId, activeRepositoryId, urlRepoId, setActiveRepositoryId, setSearchParams])

  // Switch repository handler
  const setActiveRepoId = useCallback(
    (repoId: string) => {
      setActiveRepositoryId(repoId)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (repoId) {
            next.set('repo', repoId)
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
