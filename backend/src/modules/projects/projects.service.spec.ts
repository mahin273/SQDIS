import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { DataFilterService } from '../auth/services/data-filter.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: {
    project: Record<string, jest.Mock>;
    repository: Record<string, jest.Mock>;
    projectRepository: Record<string, jest.Mock>;
    teamProjectAssignment: Record<string, jest.Mock>;
    commit: Record<string, jest.Mock>;
    debtItem: Record<string, jest.Mock>;
    coverageReport: Record<string, jest.Mock>;
    sQSScore: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let dataFilterService: {
    createProjectFilter: jest.Mock;
  };

  const project = {
    id: 'project-1',
    name: 'Platform',
    description: 'Core platform',
    organizationId: 'org-1',
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      project: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      repository: {
        findFirst: jest.fn(),
      },
      projectRepository: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      teamProjectAssignment: {
        updateMany: jest.fn(),
      },
      commit: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      debtItem: {
        groupBy: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      coverageReport: {
        findFirst: jest.fn(),
      },
      sQSScore: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    dataFilterService = {
      createProjectFilter: jest.fn(() => ({ organizationId: 'org-1' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: DataFilterService, useValue: dataFilterService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a project when the name is unique within the organization', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    prisma.project.create.mockResolvedValue({ ...project, _count: { repositories: 0, teamAssignments: 0 } });

    const result = await service.create(
      { name: 'Platform', description: 'Core platform' },
      'org-1',
    );

    expect(prisma.project.create).toHaveBeenCalledWith({
      data: {
        name: 'Platform',
        description: 'Core platform',
        organizationId: 'org-1',
      },
      include: expect.any(Object),
    });
    expect(result.name).toBe('Platform');
  });

  it('rejects duplicate project names', async () => {
    prisma.project.findFirst.mockResolvedValue(project);

    await expect(
      service.create({ name: 'Platform', description: 'Duplicate' }, 'org-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('finds all projects using role-based filters', async () => {
    prisma.project.findMany.mockResolvedValue([project]);

    await expect(service.findAll('org-1', 'user-1', Role.ADMIN)).resolves.toEqual([project]);
    expect(dataFilterService.createProjectFilter).toHaveBeenCalledWith('user-1', Role.ADMIN, 'org-1');
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          isActive: true,
        },
      }),
    );
  });

  it('updates a project and rejects duplicate renamed names', async () => {
    prisma.project.findUnique.mockResolvedValueOnce(project);
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'project-2', name: 'API' });
    await expect(service.update('project-1', { name: 'API' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.project.findUnique.mockResolvedValueOnce(project);
    prisma.project.findFirst.mockResolvedValueOnce(null);
    prisma.project.update.mockResolvedValue({ ...project, name: 'API' });

    await expect(service.update('project-1', { name: 'API' })).resolves.toMatchObject({
      name: 'API',
    });
  });

  it('soft deletes a project and ends active team assignments', async () => {
    prisma.project.findUnique.mockResolvedValue(project);

    await service.delete('project-1');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.teamProjectAssignment.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        endDate: null,
      },
      data: {
        endDate: expect.any(Date),
      },
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { isActive: false },
    });
  });

  it('assigns a repository to a project when both belong to the organization', async () => {
    prisma.project.findFirst.mockResolvedValue(project);
    prisma.repository.findFirst.mockResolvedValue({ id: 'repo-1' });
    prisma.projectRepository.findUnique.mockResolvedValue(null);
    prisma.projectRepository.create.mockResolvedValue({
      projectId: 'project-1',
      repositoryId: 'repo-1',
    });

    await expect(service.assignRepository('project-1', 'repo-1', 'org-1')).resolves.toMatchObject({
      projectId: 'project-1',
      repositoryId: 'repo-1',
    });
  });

  it('rejects assigning a repository that is already linked', async () => {
    prisma.project.findFirst.mockResolvedValue(project);
    prisma.repository.findFirst.mockResolvedValue({ id: 'repo-1' });
    prisma.projectRepository.findUnique.mockResolvedValue({ id: 'assignment-1' });

    await expect(service.assignRepository('project-1', 'repo-1', 'org-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns zeroed metrics when a project has no repositories', async () => {
    prisma.project.findUnique.mockResolvedValue({
      ...project,
      repositories: [],
    });

    await expect(service.getProjectMetrics('project-1')).resolves.toEqual({
      totalCommits: 0,
      bugfixCommits: 0,
      featureCommits: 0,
      refactorCommits: 0,
      testCommits: 0,
      docsCommits: 0,
      coverage: 0,
      technicalDebt: { total: 0, todo: 0, fixme: 0, hack: 0, xxx: 0 },
      recentActivity: [],
      commitTrend: [],
    });
  });

  it('throws when loading metrics for a missing project', async () => {
    prisma.project.findUnique.mockResolvedValue(null);

    await expect(service.getProjectMetrics('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
