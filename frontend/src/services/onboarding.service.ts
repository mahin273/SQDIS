import { api } from './api';
import type {
  Onboarding,
  OnboardingStatus,
  CreateOnboardingRequest,
  ExtendOnboardingRequest,
  OnboardingTemplate,
  OnboardingVelocity,
  OnboardingDashboardStats,
  MentorCapacity,
} from '@/types';

export const onboardingService = {
  /**
   * Get all onboarding processes with optional filters
   */
  async getAll(status?: OnboardingStatus, mentorId?: string): Promise<Onboarding[]> {
    const response = await api.get<Onboarding[]>('/onboarding', { params: { status, mentorId } });
    return response.data;
  },

  /**
   * Get onboarding process details by ID
   */
  async getById(id: string): Promise<Onboarding> {
    const response = await api.get<Onboarding>(`/onboarding/${id}`);
    return response.data;
  },

  /**
   * Create a new onboarding process
   */
  async create(data: CreateOnboardingRequest): Promise<Onboarding> {
    const response = await api.post<Onboarding>('/onboarding', data);
    return response.data;
  },

  /**
   * Assign a mentor to an onboarding process
   */
  async assignMentor(id: string, mentorId: string): Promise<Onboarding> {
    const response = await api.patch<Onboarding>(`/onboarding/${id}/mentor`, { mentorId });
    return response.data;
  },

  /**
   * Extend onboarding duration
   */
  async extend(id: string, data: ExtendOnboardingRequest): Promise<Onboarding> {
    const response = await api.patch<Onboarding>(`/onboarding/${id}/extend`, data);
    return response.data;
  },

  /**
   * Mark onboarding process as complete
   */
  async complete(id: string): Promise<Onboarding> {
    const response = await api.patch<Onboarding>(`/onboarding/${id}/complete`);
    return response.data;
  },

  /**
   * Get onboarding checklist items status
   */
  async getChecklist(id: string): Promise<Onboarding['checklistItems']> {
    const response = await api.get<Onboarding['checklistItems']>(`/onboarding/${id}/checklist`);
    return response.data;
  },

  /**
   * Update status of a specific checklist item
   */
  async updateChecklistItem(id: string, itemId: string, data: { isCompleted: boolean }): Promise<void> {
    await api.patch(`/onboarding/${id}/checklist/${itemId}`, data);
  },

  /**
   * Get milestone tracking statistics for dashboard
   */
  async getDashboardStats(): Promise<OnboardingDashboardStats> {
    const response = await api.get<OnboardingDashboardStats>('/onboarding/dashboard/stats');
    return response.data;
  },

  /**
   * Get list of developers at risk during onboarding
   */
  async getAtRiskDevelopers(): Promise<Onboarding[]> {
    const response = await api.get<Onboarding[]>('/onboarding/dashboard/at-risk');
    return response.data;
  },

  /**
   * Get available mentors for assignment
   */
  async getAvailableMentors(): Promise<Array<{ id: string; name: string; avatarUrl?: string; currentMentees: number }>> {
    const response = await api.get<Array<any>>(
      '/onboarding/mentors/available'
    );
    return response.data.map(m => ({
      id: m.mentorId,
      name: m.mentorName,
      currentMentees: m.currentMenteeCount,
    }));
  },

  /**
   * Get capacity status for a mentor
   */
  async getMentorCapacity(mentorId: string): Promise<MentorCapacity> {
    const response = await api.get<MentorCapacity>(`/onboarding/mentors/${mentorId}/capacity`);
    return response.data;
  },

  /**
   * Get onboarding checklist templates
   */
  async getTemplates(): Promise<OnboardingTemplate[]> {
    const response = await api.get<OnboardingTemplate[]>('/onboarding/templates');
    return response.data;
  },

  /**
   * Create a new onboarding checklist template
   */
  async createTemplate(data: { name: string; description?: string; items: Array<{ title: string; description?: string }> }): Promise<OnboardingTemplate> {
    const response = await api.post<OnboardingTemplate>('/onboarding/templates', data);
    return response.data;
  },

  /**
   * Get detailed progress information for an individual developer
   */
  async getDeveloperProgress(userId: string): Promise<{
    currentMilestones: number;
    totalMilestones: number;
    progressPercentage: number;
    avgTiming?: number;
    mentor?: { id: string; name: string };
  }> {
    const response = await api.get<{
      currentMilestones: number;
      totalMilestones: number;
      progressPercentage: number;
      avgTiming?: number;
      mentor?: { id: string; name: string };
    }>(`/onboarding/${userId}/progress`);
    return response.data;
  },

  /**
   * Get milestone timeline for an individual developer
   */
  async getMilestoneTimeline(userId: string): Promise<Array<{ id: string; title: string; completedAt?: string; dueDate?: string }>> {
    const response = await api.get<Array<{ id: string; title: string; completedAt?: string; dueDate?: string }>>(
      `/onboarding/${userId}/timeline`
    );
    return response.data;
  },

  /**
   * Get org-wide milestone velocity (time-to-first-PR, completion rates)
   */
  async getVelocity(filters?: Record<string, unknown>): Promise<OnboardingVelocity> {
    const response = await api.get<OnboardingVelocity>('/onboarding/velocity', { params: filters });
    return response.data;
  },

  /**
   * Get velocity breakdown for a specific developer
   */
  async getDeveloperVelocity(userId: string): Promise<OnboardingVelocity> {
    const response = await api.get<OnboardingVelocity>(`/onboarding/velocity/${userId}`);
    return response.data;
  },

  /**
   * Get a single onboarding template by ID
   */
  async getTemplate(id: string): Promise<OnboardingTemplate> {
    const response = await api.get<OnboardingTemplate>(`/onboarding/templates/${id}`);
    return response.data;
  },

  /**
   * Update an onboarding template
   */
  async updateTemplate(
    id: string,
    data: Partial<{ name: string; description?: string; items: Array<{ title: string; description?: string }> }>
  ): Promise<OnboardingTemplate> {
    const response = await api.patch<OnboardingTemplate>(`/onboarding/templates/${id}`, data);
    return response.data;
  },

  /**
   * Delete an onboarding template
   */
  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/onboarding/templates/${id}`);
  },
};

export default onboardingService;