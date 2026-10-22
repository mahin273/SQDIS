import { describe, it, expect, beforeEach } from 'vitest'
import { useRepositoryStore } from './repositoryStore'
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

describe('useRepositoryStore', () => {
  beforeEach(() => {
    useRepositoryStore.setState({
      activeRepositoryId: null,
      repositories: [],
      isLoading: false,
      isHydrated: true,
      error: null,
    })
  })

  it('preserves null activeRepositoryId when setRepositories is called (All Repositories mode)', () => {
    const store = useRepositoryStore.getState()
    expect(store.activeRepositoryId).toBeNull()

    store.setRepositories(mockRepos)

    const updated = useRepositoryStore.getState()
    expect(updated.repositories).toHaveLength(2)
    expect(updated.activeRepositoryId).toBeNull()
  })

  it('preserves an active repository selection if it exists in the updated list', () => {
    useRepositoryStore.getState().setActiveRepositoryId('repo-2')
    useRepositoryStore.getState().setRepositories(mockRepos)

    const updated = useRepositoryStore.getState()
    expect(updated.activeRepositoryId).toBe('repo-2')
  })

  it('resets activeRepositoryId to null if the previously selected repo is removed', () => {
    useRepositoryStore.getState().setActiveRepositoryId('repo-deleted')
    useRepositoryStore.getState().setRepositories(mockRepos)

    const updated = useRepositoryStore.getState()
    expect(updated.activeRepositoryId).toBeNull()
  })

  it('normalizes empty string to null in setActiveRepositoryId', () => {
    useRepositoryStore.getState().setActiveRepositoryId('repo-1')
    expect(useRepositoryStore.getState().activeRepositoryId).toBe('repo-1')

    useRepositoryStore.getState().setActiveRepositoryId('')
    expect(useRepositoryStore.getState().activeRepositoryId).toBeNull()
  })

  it('clears state cleanly on clearRepository', () => {
    useRepositoryStore.getState().setActiveRepositoryId('repo-1')
    useRepositoryStore.getState().setRepositories(mockRepos)
    useRepositoryStore.getState().clearRepository()

    const cleared = useRepositoryStore.getState()
    expect(cleared.activeRepositoryId).toBeNull()
    expect(cleared.repositories).toEqual([])
  })
})
