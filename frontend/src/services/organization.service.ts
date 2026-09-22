import { api } from './api';
import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationMember,
  InviteMemberRequest,
  Invitation,
  UpdateMemberRequest,
  RepositoryContributor,
} from '@/types';

export const organizationService = {
  /**
   * Get all organizations for the current user
   */
  async getAll(): Promise<Organization[]> {
    const response = await api.get<Organization[]>('/organizations');
    return response.data;
  },

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<Organization> {
    const response = await api.get<Organization>(`/organizations/${id}`);
    return response.data;
  },

  /**
   * Create a new organization
   */
  async create(data: CreateOrganizationRequest): Promise<Organization> {
    const response = await api.post<Organization>('/organizations', data);
    return response.data;
  },

  /**
   * Update organization settings
   */
  async update(id: string, data: UpdateOrganizationRequest): Promise<Organization> {
    const response = await api.patch<Organization>(`/organizations/${id}`, data);
    return response.data;
  },

  /**
   * Delete organization
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/organizations/${id}`);
  },

  /**
   * Get all invitations for the organization
   */
  async getInvitations(id: string): Promise<Invitation[]> {
    try {
      const response = await api.get<Invitation[]>(`/organizations/${id}/invitations`);
      return response.data || [];
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return [];
      }
      throw err;
    }
  },

  /**
   * Revoke an invitation
   */
  async revokeInvitation(id: string, invitationId: string): Promise<void> {
    await api.delete(`/organizations/${id}/invitations/${invitationId}`);
  },

  /**
   * Get organization members
   */
  async getMembers(id: string): Promise<OrganizationMember[]> {
    const response = await api.get<OrganizationMember[]>(`/organizations/${id}/members`);
    return response.data;
  },

  /**
   * Get discovered repository contributors from connected repositories
   */
  async getRepositoryContributors(id: string): Promise<RepositoryContributor[]> {
    try {
      const response = await api.get<RepositoryContributor[]>(`/organizations/${id}/repository-contributors`);
      return response.data || [];
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return [];
      }
      throw err;
    }
  },

  /**
   * Invite a member to the organization
   */
  async inviteMember(id: string, data: InviteMemberRequest): Promise<Invitation> {
    const response = await api.post<Invitation>(`/organizations/${id}/invite`, data);
    return response.data;
  },

  /**
   * Invite all uninvited members and contributors
   */
  async inviteAll(id: string): Promise<{ totalInvited: number; emails: string[] }> {
    const response = await api.post<{ totalInvited: number; emails: string[] }>(`/organizations/${id}/invite-all`);
    return response.data;
  },

  /**
   * Resend an invitation
   */
  async resendInvitation(id: string, data: InviteMemberRequest): Promise<Invitation> {
    const response = await api.post<Invitation>(`/organizations/${id}/invite/resend`, data);
    return response.data;
  },

  /**
   * Get invitation details by token
   */
  async getInvitation(token: string): Promise<Invitation> {
    const response = await api.get<Invitation>(`/organizations/invitations/${token}`);
    return response.data;
  },

  /**
   * Accept an invitation to join an organization
   */
  async acceptInvitation(token: string): Promise<OrganizationMember> {
    const response = await api.post<OrganizationMember>(`/organizations/invitations/${token}/accept`);
    return response.data;
  },

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    data: UpdateMemberRequest
  ): Promise<OrganizationMember> {
    const response = await api.patch<OrganizationMember>(
      `/organizations/${organizationId}/members/${userId}`,
      data
    );
    return response.data;
  },

  /**
   * Remove member from organization
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    await api.delete(`/organizations/${organizationId}/members/${userId}`);
  },
};

export default organizationService;