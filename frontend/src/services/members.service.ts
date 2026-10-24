import { api } from './api';
import type {
  OrganizationMember,
  Invitation,
  UnmappedEmail,
  AssignEmailRequest,
  UserRole,
  MemberRemovalRequest,
  RemovalRequestStatus,
} from '@/types';

export const membersService = {
  /**
   * Get all members of the organization
   */
  async getAll(): Promise<OrganizationMember[]> {
    const response = await api.get<OrganizationMember[]>('/organizations/members');
    return response.data;
  },

  /**
   * Get all invitations for the organization
   */
  async getInvitations(): Promise<Invitation[]> {
    try {
      const response = await api.get<Invitation[]>('/organizations/invitations');
      return response.data || [];
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return [];
      }
      throw err;
    }
  },

  /**
   * Get all unmapped emails for the organization
   */
  async getUnmappedEmails(): Promise<UnmappedEmail[]> {
    const response = await api.get<UnmappedEmail[]>('/admin/unmapped-emails');
    return response.data;
  },

  /**
   * Assign an email to a user without verification
   */
  async assignEmail(data: AssignEmailRequest): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/admin/email-aliases/assign', data);
    return response.data;
  },

  /**
   * Remove an email mapping
   */
  async removeEmailMapping(aliasId: string): Promise<void> {
    await api.delete(`/admin/email-aliases/${aliasId}`);
  },

  /**
   * Update member role
   */
  async updateRole(userId: string, role: UserRole): Promise<OrganizationMember> {
    const response = await api.patch<OrganizationMember>(`/organizations/members/${userId}`, { role });
    return response.data;
  },

  /**
   * Remove member from organization
   */
  async remove(userId: string): Promise<{ status?: string; message?: string } | void> {
    const response = await api.delete(`/organizations/members/${userId}`);
    return response.data;
  },

  /**
   * Submit a member removal request for Owner approval (Admin workflow)
   */
  async createRemovalRequest(
    targetUserId: string,
    reason?: string,
  ): Promise<MemberRemovalRequest> {
    const response = await api.post<MemberRemovalRequest>('/organizations/removal-requests', {
      targetUserId,
      reason,
    });
    return response.data;
  },

  /**
   * Get member removal requests
   */
  async getRemovalRequests(
    status?: RemovalRequestStatus,
  ): Promise<MemberRemovalRequest[]> {
    const response = await api.get<MemberRemovalRequest[]>('/organizations/removal-requests', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  /**
   * Approve member removal request (Owner only)
   */
  async approveRemovalRequest(
    requestId: string,
    decisionReason?: string,
  ): Promise<MemberRemovalRequest> {
    const response = await api.post<MemberRemovalRequest>(
      `/organizations/removal-requests/${requestId}/approve`,
      { decisionReason },
    );
    return response.data;
  },

  /**
   * Reject member removal request (Owner only)
   */
  async rejectRemovalRequest(
    requestId: string,
    decisionReason?: string,
  ): Promise<MemberRemovalRequest> {
    const response = await api.post<MemberRemovalRequest>(
      `/organizations/removal-requests/${requestId}/reject`,
      { decisionReason },
    );
    return response.data;
  },

  /**
   * Cancel a pending member removal request
   */
  async cancelRemovalRequest(requestId: string): Promise<void> {
    await api.delete(`/organizations/removal-requests/${requestId}`);
  },
};

export default membersService;