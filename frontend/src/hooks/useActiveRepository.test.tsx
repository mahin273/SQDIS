import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useActiveRepository } from './useActiveRepository'
import { useRepositoryStore } from '@/stores/repositoryStore'
import { repositoriesService } from '@/services/repositories.service'
import type { Repository } from '@/types'

const mockRepos: Repository[] = [
  {
    id: 'repo-1',
    name: 'backend-core',
    fullName: 'sqdis/backend-core',
    url: 'https://github.com/sqdis/backend-core',
    defaultBranch: 'main',
    private: false,
    isEnabled: true,
    organizationId: 'org-1',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'repo-2',
    name: 'frontend-web',
    fullName: 'sqdis/frontend-web',
    url: 'https://github.com/sqdis/frontend-web',
    defaultBranch: 'main',
    private: false,
    isEnabled: true,
    organizationId: 'org-1',
    createdAt: '2026-01-01T00:00:00Z',
  },
]

vi.mock('@/services/repositories.service', () => ({
  repositoriesService: {
    getConnected: vi.fn(),
  },
}))

function createWrapper(initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe('useActiveRepository hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositoriesService.getConnected).mockResolvedValue(mockRepos)
    useRepositoryStore.setState({
      activeRepositoryId: null,
      repositories: [],
      isLoading: false,
      isHydrated: true,
      error: null,
    })
  })

  it('defaults to All Repositories mode when requireSelection is false and no selection exists', async () => {
    const { result } = renderHook(() => useActiveRepository(), {
      wrapper: createWrapper(['/coverage']),
    })

    await waitFor(() => {
      expect(result.current.hasRepositories).toBe(true)
    })

    expect(result.current.activeRepoId).toBe('')
    expect(result.current.activeRepo).toBeNull()
  })

  it('selects repository and updates URL search params when setActiveRepoId is called', async () => {
    const { result } = renderHook(
      () => {
        const repoHook = useActiveRepository()
        const location = useLocation()
        return { ...repoHook, search: location.search }
      },
      {
        wrapper: createWrapper(['/coverage']),
      }
    )

    await waitFor(() => {
      expect(result.current.hasRepositories).toBe(true)
    })

    act(() => {
      result.current.setActiveRepoId('repo-2')
    })

    expect(result.current.activeRepoId).toBe('repo-2')
    expect(result.current.activeRepo?.name).toBe('frontend-web')
    expect(result.current.search).toContain('repo=repo-2')
    expect(useRepositoryStore.getState().activeRepositoryId).toBe('repo-2')
  })

  it('clears selection to All Repositories without being overwritten by first repository', async () => {
    const { result } = renderHook(
      () => {
        const repoHook = useActiveRepository()
        const location = useLocation()
        return { ...repoHook, search: location.search }
      },
      {
        wrapper: createWrapper(['/coverage?repo=repo-1']),
      }
    )

    await waitFor(() => {
      expect(result.current.activeRepoId).toBe('repo-1')
    })

    // Explicitly clear selection to All Repositories
    act(() => {
      result.current.setActiveRepoId('')
    })

    await waitFor(() => {
      expect(result.current.activeRepoId).toBe('')
    })

    expect(result.current.activeRepo).toBeNull()
    expect(result.current.search).toBe('')
    expect(useRepositoryStore.getState().activeRepositoryId).toBeNull()
  })

  it('falls back to first repository when requireSelection is true and no repo is selected', async () => {
    const { result } = renderHook(
      () => useActiveRepository({ requireSelection: true }),
      {
        wrapper: createWrapper(['/code-intelligence']),
      }
    )

    await waitFor(() => {
      expect(result.current.hasRepositories).toBe(true)
    })

    expect(result.current.activeRepoId).toBe('repo-1')
    expect(result.current.activeRepo?.name).toBe('backend-core')
  })

  it('respects URL search param over persisted store selection', async () => {
    useRepositoryStore.setState({ activeRepositoryId: 'repo-1' })

    const { result } = renderHook(() => useActiveRepository(), {
      wrapper: createWrapper(['/coverage?repo=repo-2']),
    })

    await waitFor(() => {
      expect(result.current.hasRepositories).toBe(true)
    })

    expect(result.current.activeRepoId).toBe('repo-2')
    expect(result.current.activeRepo?.name).toBe('frontend-web')
  })
})
