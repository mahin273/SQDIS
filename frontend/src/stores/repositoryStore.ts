import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Repository } from '@/types'
import { repositoriesService } from '@/services/repositories.service'

interface RepositoryState {
  activeRepositoryId: string | null
  repositories: Repository[]
  isLoading: boolean
  isHydrated: boolean
  error: string | null

  // Actions
  setActiveRepositoryId: (id: string | null) => void
  setRepositories: (repos: Repository[]) => void
  fetchRepositories: () => Promise<Repository[]>
  clearRepository: () => void
  setHydrated: (hydrated: boolean) => void
  clearError: () => void
}

export const useRepositoryStore = create<RepositoryState>()(
  persist(
    (set, get) => ({
      activeRepositoryId: null,
      repositories: [],
      isLoading: false,
      isHydrated: false,
      error: null,

      setActiveRepositoryId: (id: string | null) => {
        set({ activeRepositoryId: id })
      },

      setRepositories: (repos: Repository[]) => {
        const currentActive = get().activeRepositoryId
        const activeExists = repos.some((r) => r.id === currentActive)
        
        set({
          repositories: repos,
          // If active ID is missing or not in new repo list, auto-select first available repo
          activeRepositoryId: activeExists
            ? currentActive
            : repos.length > 0
              ? repos[0].id
              : null,
        })
      },

      fetchRepositories: async () => {
        set({ isLoading: true, error: null })
        try {
          const repos = await repositoriesService.getConnected()
          const currentActive = get().activeRepositoryId
          const activeExists = repos.some((r: Repository) => r.id === currentActive)

          set({
            repositories: repos,
            activeRepositoryId: activeExists
              ? currentActive
              : repos.length > 0
                ? repos[0].id
                : null,
            isLoading: false,
          })
          return repos
        } catch (err: any) {
          const errorMsg = err?.response?.data?.message || err?.message || 'Failed to load repositories'
          set({ error: errorMsg, isLoading: false })
          return []
        }
      },

      clearRepository: () => {
        set({ activeRepositoryId: null, repositories: [], error: null })
      },

      setHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated })
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: 'sqdis-repository-storage',
      partialize: (state) => ({
        activeRepositoryId: state.activeRepositoryId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true)
        }
      },
    }
  )
)
