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
        set({ activeRepositoryId: id || null })
      },

      setRepositories: (repos: Repository[]) => {
        const currentActive = get().activeRepositoryId
        // If active ID is null or empty, preserve it as All Repositories selection.
        // If an explicit repository ID was selected, verify it still exists in the refreshed list.
        const nextActiveId =
          !currentActive
            ? null
            : repos.some((r) => r.id === currentActive)
              ? currentActive
              : null

        set({
          repositories: repos,
          activeRepositoryId: nextActiveId,
        })
      },

      fetchRepositories: async () => {
        set({ isLoading: true, error: null })
        try {
          const repos = await repositoriesService.getConnected()
          const currentActive = get().activeRepositoryId
          const nextActiveId =
            !currentActive
              ? null
              : repos.some((r: Repository) => r.id === currentActive)
                ? currentActive
                : null

          set({
            repositories: repos,
            activeRepositoryId: nextActiveId,
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
