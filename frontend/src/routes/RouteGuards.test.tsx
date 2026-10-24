import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
import { useOrganizationStore } from '@/stores/organizationStore';
import type { UserRole } from '@/types';

function createTestHarness(initialRoute: string, requiredRoles?: UserRole[]) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<ProtectedRoute requiredRoles={requiredRoles} />}>
          <Route path="/protected-area" element={<div>Protected Content Granted</div>} />
        </Route>
        <Route path="/forbidden" element={<div>Access Forbidden 403</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Frontend ProtectedRoute RBAC & Tenant Isolation', () => {
  beforeEach(() => {
    useOrganizationStore.setState({
      isHydrated: true,
      fetchOrganizations: vi.fn().mockResolvedValue([]),
      currentOrganization: {
        id: 'org-acme',
        name: 'Acme Corp',
        slug: 'acme',
        role: 'DEVELOPER' as UserRole,
      } as any,
      organizations: [
        {
          id: 'org-acme',
          name: 'Acme Corp',
          slug: 'acme',
          role: 'DEVELOPER' as UserRole,
        } as any,
      ],
    });

    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'u-1',
        email: 'user@acme.com',
        name: 'Test User',
        memberships: [
          {
            id: 'm-1',
            organizationId: 'org-acme',
            role: 'DEVELOPER' as UserRole,
          } as any,
        ],
      } as any,
    });
  });

  describe('Developer Role Route Restrictions', () => {
    beforeEach(() => {
      useOrganizationStore.setState({
        currentOrganization: {
          id: 'org-acme',
          role: 'DEVELOPER' as UserRole,
        } as any,
      });
      useAuthStore.setState({
        user: {
          id: 'u-dev',
          memberships: [{ organizationId: 'org-acme', role: 'DEVELOPER' as UserRole } as any],
        } as any,
      });
    });

    it('blocks Developer from accessing Manager routes (OWNER, ADMIN, TEAM_LEAD)', () => {
      createTestHarness('/protected-area', ['OWNER', 'ADMIN', 'TEAM_LEAD']);
      expect(screen.getByText('Access Forbidden 403')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content Granted')).not.toBeInTheDocument();
    });

    it('blocks Developer from accessing Admin routes (OWNER, ADMIN)', () => {
      createTestHarness('/protected-area', ['OWNER', 'ADMIN']);
      expect(screen.getByText('Access Forbidden 403')).toBeInTheDocument();
    });

    it('blocks Developer from accessing Owner routes (OWNER)', () => {
      createTestHarness('/protected-area', ['OWNER']);
      expect(screen.getByText('Access Forbidden 403')).toBeInTheDocument();
    });

    it('allows Developer to access General routes (All roles)', () => {
      createTestHarness('/protected-area', ['OWNER', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER']);
      expect(screen.getByText('Protected Content Granted')).toBeInTheDocument();
    });
  });

  describe('Team Lead Role Route Access', () => {
    beforeEach(() => {
      useOrganizationStore.setState({
        currentOrganization: {
          id: 'org-acme',
          role: 'TEAM_LEAD' as UserRole,
        } as any,
      });
      useAuthStore.setState({
        user: {
          id: 'u-lead',
          memberships: [{ organizationId: 'org-acme', role: 'TEAM_LEAD' as UserRole } as any],
        } as any,
      });
    });

    it('allows Team Lead to access Manager routes (OWNER, ADMIN, TEAM_LEAD)', () => {
      createTestHarness('/protected-area', ['OWNER', 'ADMIN', 'TEAM_LEAD']);
      expect(screen.getByText('Protected Content Granted')).toBeInTheDocument();
    });

    it('blocks Team Lead from accessing Admin governance routes (OWNER, ADMIN)', () => {
      createTestHarness('/protected-area', ['OWNER', 'ADMIN']);
      expect(screen.getByText('Access Forbidden 403')).toBeInTheDocument();
    });

    it('blocks Team Lead from accessing Owner integration routes (OWNER)', () => {
      createTestHarness('/protected-area', ['OWNER']);
      expect(screen.getByText('Access Forbidden 403')).toBeInTheDocument();
    });
  });

  describe('Admin Role Route Access', () => {
    beforeEach(() => {
      useOrganizationStore.setState({
        currentOrganization: {
          id: 'org-acme',
          role: 'ADMIN' as UserRole,
        } as any,
      });
      useAuthStore.setState({
        user: {
          id: 'u-admin',
          memberships: [{ organizationId: 'org-acme', role: 'ADMIN' as UserRole } as any],
        } as any,
      });
    });

    it('allows Admin to access Manager routes and Admin routes', () => {
      createTestHarness('/protected-area', ['OWNER', 'ADMIN']);
      expect(screen.getByText('Protected Content Granted')).toBeInTheDocument();
    });

    it('blocks Admin from accessing Owner-only GitHub integration routes (OWNER)', () => {
      createTestHarness('/protected-area', ['OWNER']);
      expect(screen.getByText('Access Forbidden 403')).toBeInTheDocument();
    });
  });

  describe('Owner Role Route Access', () => {
    beforeEach(() => {
      useOrganizationStore.setState({
        currentOrganization: {
          id: 'org-acme',
          role: 'OWNER' as UserRole,
        } as any,
      });
      useAuthStore.setState({
        user: {
          id: 'u-owner',
          memberships: [{ organizationId: 'org-acme', role: 'OWNER' as UserRole } as any],
        } as any,
      });
    });

    it('allows Owner to access Owner-only routes', () => {
      createTestHarness('/protected-area', ['OWNER']);
      expect(screen.getByText('Protected Content Granted')).toBeInTheDocument();
    });

    it('allows Owner to access all areas across the role matrix', () => {
      createTestHarness('/protected-area', ['OWNER', 'ADMIN']);
      expect(screen.getByText('Protected Content Granted')).toBeInTheDocument();
    });
  });

  describe('Tenant Isolation & Fail-Closed Role Resolution', () => {
    it('fails closed and blocks access if active organization has no matching membership', async () => {
      useOrganizationStore.setState({
        currentOrganization: {
          id: 'org-other',
          role: undefined,
        } as any,
      });
      useAuthStore.setState({
        user: {
          id: 'u-cross-tenant',
          memberships: [
            { organizationId: 'org-acme', role: 'OWNER' as UserRole } as any,
          ],
        } as any,
      });

      // User is OWNER in org-acme, but currentOrganization is org-other where user is not a member.
      // Must NOT leak org-acme's OWNER role to org-other!
      createTestHarness('/protected-area', ['OWNER']);
      expect(await screen.findByText('Access Forbidden 403')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content Granted')).not.toBeInTheDocument();
    });
  });
});
