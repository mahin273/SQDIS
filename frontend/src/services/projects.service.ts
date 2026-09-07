import { api } from './api';
import type {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  AssignRepositoryRequest,
  AssignTeamRequest,
  ProjectMetrics,
  ProjectDebtItem,
} from '@/types';

export const projectsService = {
  /**
   * Get all projects for the current organization
   */
  async getAll(): Promise<Project[]> {
    const response = await api.get<any[]>('/projects');
    return response.data.map((project) => ({
      ...project,
      sqs: project.sqs ?? project.sqsScore ?? 0,
      sqsScore: project.sqsScore ?? project.sqs ?? 0,
      repositoryCount: project.repositoryCount ?? project._count?.repositories ?? project.repositories?.length ?? 0,
      teamCount: project.teamCount ?? project._count?.teamAssignments ?? project.teams?.length ?? 0,
    }));
  },

  /**
   * Get project by ID
   */
  async getById(id: string): Promise<Project> {
    const response = await api.get<any>(`/projects/${id}`);
    const project = response.data;

    return {
      ...project,
      repositories: (project.repositories ?? []).map((assignment: any) => assignment.repository ?? assignment),
      teams: (project.teamAssignments ?? []).map((assignment: any) => assignment.team),
      repositoryCount: project.repositoryCount ?? project._count?.repositories ?? project.repositories?.length ?? 0,
      teamCount: project.teamCount ?? project._count?.teamAssignments ?? project.teamAssignments?.length ?? 0,
      sqs: project.sqs ?? project.sqsScore ?? 0,
      sqsScore: project.sqsScore ?? project.sqs ?? 0,
    };
  },

  /**
   * Create a new project
   */
  async create(data: CreateProjectRequest): Promise<Project> {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },

  /**
   * Update project
   */
  async update(id: string, data: UpdateProjectRequest): Promise<Project> {
    const response = await api.patch<Project>(`/projects/${id}`, data);
    return response.data;
  },

  /**
   * Delete project (soft delete)
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  /**
   * Get project metrics
   */
  async getMetrics(id: string): Promise<ProjectMetrics> {
    const response = await api.get<ProjectMetrics>(`/projects/${id}/metrics`);
    return response.data;
  },

  /**
   * Get technical debt items for a project
   */
  async getTechnicalDebt(id: string): Promise<ProjectDebtItem[]> {
    const response = await api.get<any>(`/projects/${id}/debt`);
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  },

  /**
   * Assign repository to project
   */
  async assignRepository(id: string, data: AssignRepositoryRequest): Promise<Project> {
    const response = await api.post<Project>(`/projects/${id}/repositories`, data);
    return response.data;
  },

  /**
   * Remove repository from project
   */
  async removeRepository(id: string, repoId: string): Promise<void> {
    await api.delete(`/projects/${id}/repositories/${repoId}`);
  },

  /**
   * Assign team to project
   */
  async assignTeam(id: string, data: AssignTeamRequest): Promise<Project> {
    const response = await api.post<Project>(`/projects/${id}/teams`, data);
    return response.data;
  },

  /**
   * Remove team from project
   */
  async removeTeam(id: string, teamId: string): Promise<void> {
    await api.delete(`/projects/${id}/teams/${teamId}`);
  },
};

export default projectsService;
