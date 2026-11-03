import { api } from './api';
import type {
  Report,
  CreateReportRequest,
  ReportFilters,
  ReportListResponse,
  LeaderboardQuery,
  LeaderboardEntry,
} from '@/types';

export const reportsService = {
  /**
   * Create a new report (PDF or CSV)
   */
  async create(data: CreateReportRequest, format: 'pdf' | 'csv' = 'pdf'): Promise<Report> {
    const response = await api.post<Report>(`/reports/${format}`, data);
    return response.data;
  },

  /**
   * Trigger typed PDF report generation
   */
  async createPdf(data: CreateReportRequest): Promise<Report> {
    const response = await api.post<Report>('/reports/pdf', data);
    return response.data;
  },

  /**
   * Trigger typed CSV report generation
   */
  async createCsv(data: CreateReportRequest): Promise<Report> {
    const response = await api.post<Report>('/reports/csv', data);
    return response.data;
  },

  /**
   * Get all reports with filters
   */
  async getAll(filters?: ReportFilters): Promise<ReportListResponse> {
    const response = await api.get<ReportListResponse>('/reports', { params: filters });
    return response.data;
  },

  /**
   * Get report by ID
   */
  async getById(id: string): Promise<Report> {
    const response = await api.get<Report>(`/reports/${id}`);
    return response.data;
  },

  /**
   * Retry a failed report generation
   */
  async retry(id: string): Promise<Report> {
    const response = await api.post<Report>(`/reports/${id}/retry`);
    return response.data;
  },

  /**
   * Delete a report
   */
  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/reports/${id}`);
    return response.data;
  },

  /**
   * Download report file
   */
  async download(id: string): Promise<Blob> {
    const response = await api.get<Blob>(`/reports/${id}/download`, { responseType: 'blob' });
    return response.data;
  },

  /**
   * Get team leaderboard ranked by average DQS
   */
  async getTeamLeaderboard(query?: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const response = await api.get<LeaderboardEntry[]>('/reports/teams', { params: query });
    return response.data;
  },
};

export const leaderboardService = {
  /**
   * Get developer leaderboard
   */
  async getDevelopers(query?: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const response = await api.get<LeaderboardEntry[]>('/leaderboard', { params: query });
    return response.data;
  },

  /**
   * Get team leaderboard
   */
  async getTeams(query?: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const response = await api.get<LeaderboardEntry[]>('/leaderboard/teams', { params: query });
    return response.data;
  },
};

export default reportsService;
