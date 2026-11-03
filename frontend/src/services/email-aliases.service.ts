import { api } from './api';
import type { EmailAlias, AddEmailAliasRequest, UnmappedEmail, AssignEmailRequest } from '@/types';

export const emailAliasesService = {
  /**
   * Add a new email alias
   */
  async add(data: AddEmailAliasRequest): Promise<EmailAlias> {
    const response = await api.post<EmailAlias>('/email-aliases', data);
    return response.data;
  },

  /**
   * Alias for add() for backward compatibility
   */
  async create(email: string): Promise<EmailAlias> {
    const response = await api.post<EmailAlias>('/email-aliases', { email });
    return response.data;
  },

  /**
   * Alias for remove() for backward compatibility
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/email-aliases/${id}`);
  },

  /**
   * Get all email aliases for the current user
   */
  async getAll(): Promise<EmailAlias[]> {
    const response = await api.get<EmailAlias[]>('/email-aliases');
    return response.data;
  },

  /**
   * Resend verification email
   */
  async resendVerification(id: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(`/email-aliases/${id}/resend`);
    return response.data;
  },

  /**
   * Verify an email alias using verification token
   */
  async verify(token: string): Promise<{ success: boolean; message: string }> {
    const response = await api.get<{ success: boolean; message: string }>(`/email-aliases/verify/${token}`);
    return response.data;
  },

  /**
   * Remove an email alias
   */
  async remove(id: string): Promise<void> {
    await api.delete(`/email-aliases/${id}`);
  },

  /**
   * Get all unmapped commit author emails for current organization (Admin only)
   */
  async getUnmappedEmails(): Promise<UnmappedEmail[]> {
    const response = await api.get<UnmappedEmail[]>('/admin/unmapped-emails');
    return response.data;
  },

  /**
   * Assign an unmapped email to a team member (Admin only)
   */
  async assignEmail(data: AssignEmailRequest): Promise<EmailAlias> {
    const response = await api.post<EmailAlias>('/admin/email-aliases/assign', data);
    return response.data;
  },

  /**
   * Remove an email alias mapping (Admin only)
   */
  async removeEmailMapping(id: string): Promise<void> {
    await api.delete(`/admin/email-aliases/${id}`);
  },
};

export default emailAliasesService;