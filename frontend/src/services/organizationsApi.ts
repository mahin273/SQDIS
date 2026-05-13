import { apiClient } from './apiClient';
import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationMember,
  InviteRequest,
  Invitation,
  AcceptInvitationRequest,
  UpdateMemberRequest,
} from '../types/api.types';

/**
 * Organizations API Client
 * Handles organization and member management
 */
export const organizationsApi = {
  /**
   * Get all organizations
   */
  getAll: async (): Promise<Organization[]> => {
    const response = await apiClient.get<Organization[]>('/organizations');
    return response.data;
  },

  /**
   * Get organization by ID
   */
  getById: async (id: string): Promise<Organization> => {
    const response = await apiClient.get<Organization>(`/organizations/${id}`);
    return response.data;
  },

  /**
   * Create a new organization
   */
  create: async (data: CreateOrganizationRequest): Promise<Organization> => {
    const response = await apiClient.post<Organization>('/organizations', data);
    return response.data;
  },

  /**
   * Update organization
   */
  update: async (id: string, data: UpdateOrganizationRequest): Promise<Organization> => {
    const response = await apiClient.patch<Organization>(`/organizations/${id}`, data);
    return response.data;
  },

  /**
   * Delete organization
   */
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/organizations/${id}`);
    return response.data;
  },

  /**
   * Get organization members
   */
  getMembers: async (id: string): Promise<OrganizationMember[]> => {
    const response = await apiClient.get<OrganizationMember[]>(`/organizations/${id}/members`);
    return response.data;
  },

  /**
   * Invite user to organization
   */
  inviteUser: async (id: string, data: InviteRequest): Promise<Invitation> => {
    const response = await apiClient.post<Invitation>(`/organizations/${id}/invite`, data);
    return response.data;
  },

  /**
   * Resend invitation
   */
  resendInvitation: async (id: string, email: string): Promise<Invitation> => {
    const response = await apiClient.post<Invitation>(`/organizations/${id}/invite/resend`, {
      email,
    });
    return response.data;
  },

  /**
   * Get invitation details by token
   */
  getInvitation: async (token: string): Promise<Invitation> => {
    const response = await apiClient.get<Invitation>(`/organizations/invitations/${token}`);
    return response.data;
  },

  /**
   * Accept organization invitation
   */
  acceptInvitation: async (data: AcceptInvitationRequest): Promise<OrganizationMember> => {
    const response = await apiClient.post<OrganizationMember>(
      `/organizations/invitations/${data.token}/accept`,
      {}
    );
    return response.data;
  },

  /**
   * Update member role
   */
  updateMember: async (
    organizationId: string,
    userId: string,
    data: UpdateMemberRequest
  ): Promise<OrganizationMember> => {
    const response = await apiClient.patch<OrganizationMember>(
      `/organizations/${organizationId}/members/${userId}`,
      data
    );
    return response.data;
  },

  /**
   * Remove member from organization
   */
  removeMember: async (organizationId: string, userId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(
      `/organizations/${organizationId}/members/${userId}`
    );
    return response.data;
  },
};

export default organizationsApi;
