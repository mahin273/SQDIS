import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Organization } from '@/types'
import { setCurrentOrganizationId } from '@/services/api'

interface OrganizationState {
  currentOrganization: Organization | null
  organizations: Organization[]
  isLoading: boolean
  isHydrated: boolean
  error: string | null

  // Actions
  setCurrentOrganization: (org: Organization | null) => void
  setOrganizations: (orgs: Organization[]) => void
  fetchOrganizations: () => Promise<Organization[]>
  switchOrganization: (orgId: string) => Promise<void>
  clearOrganization: () => void
  setHydrated: (hydrated: boolean) => void
  clearError: () => void
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      currentOrganization: null,
      organizations: [],
      isLoading: false,
      isHydrated: false,
      error: null,

      setCurrentOrganization: (org: Organization | null) => {
        set({ currentOrganization: org })
        // Sync with API service
        setCurrentOrganizationId(org?.id || null)
      },

      setOrganizations: (orgs: Organization[]) => {
        const current = get().currentOrganization
        let updatedCurrent: Organization | null = null
        if (current) {
          updatedCurrent = orgs.find((o: Organization) => o.id === current.id) || null
        }
        if (!updatedCurrent && orgs.length > 0) {
          updatedCurrent = orgs[0]
        }
        set({ organizations: orgs, currentOrganization: updatedCurrent })
        setCurrentOrganizationId(updatedCurrent?.id || null)
      },

      fetchOrganizations: async () => {
        set({ isLoading: true, error: null })
        try {
          const { organizationService } = await import('@/services')
          const orgs = await organizationService.getAll()
          get().setOrganizations(orgs)
          set({ isLoading: false })
          return orgs
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load organizations'
          set({ error: message, isLoading: false })
          return []
        }
      },

      switchOrganization: async (orgId: string) => {
        let org = get().organizations.find((o: Organization) => o.id === orgId)

        if (!org) {
          const orgs = await get().fetchOrganizations()
          org = orgs.find((item: Organization) => item.id === orgId)
        }

        if (!org) {
          set({ error: 'Organization not found' })
          return
        }

        set({ currentOrganization: org, error: null })
        setCurrentOrganizationId(org.id)
      },

      clearOrganization: () => {
        set({ currentOrganization: null, organizations: [], error: null })
        // Sync with API service
        setCurrentOrganizationId(null)
      },

      setHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated })
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: 'organization-storage',
      partialize: (state: OrganizationState) => ({
        currentOrganization: state.currentOrganization, // This includes the role field
        organizations: state.organizations, // Also persist all organizations with roles
      }),
      onRehydrateStorage: () => (state?: OrganizationState, error?: Error | unknown) => {
        if (error) {
          console.error('[OrganizationStore] Rehydration error:', error)
          return
        }
        // Sync organization ID with API service after rehydration
        if (state?.currentOrganization?.id) {
          setCurrentOrganizationId(state.currentOrganization.id)
        }
        // Mark as hydrated - use setTimeout to avoid circular reference
        setTimeout(() => {
          useOrganizationStore.setState({ isHydrated: true })
        }, 0)
      },
    }
  )
)

// Initialize organization ID from localStorage immediately on module load
// This ensures the API service has the organization ID before any requests are made
try {
  const stored = localStorage.getItem('organization-storage')
  if (stored) {
    const parsed = JSON.parse(stored)
    const orgId = parsed?.state?.currentOrganization?.id || parsed?.currentOrganization?.id
    if (orgId) {
      setCurrentOrganizationId(orgId)
    }
  }
} catch (e) {
  console.error('[OrganizationStore] Failed to initialize from localStorage:', e)
}
