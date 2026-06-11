import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  const projectsServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    getProjectMetrics: jest.fn(),
    getTechnicalDebt: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    assignRepository: jest.fn(),
    removeRepository: jest.fn(),
    assignTeam: jest.fn(),
    removeTeam: jest.fn(),
    verifyProjectAccess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: OrganizationsService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ProjectsController>(ProjectsController);
    jest.clearAllMocks();
  });

  it('creates a project for the current organization', async () => {
    projectsServiceMock.create.mockResolvedValue({ id: 'project-1', name: 'Platform' });

    await expect(
      controller.create({ name: 'Platform', description: 'Core' }, 'user-1', 'org-1'),
    ).resolves.toMatchObject({ id: 'project-1' });
    expect(projectsServiceMock.create).toHaveBeenCalledWith(
      { name: 'Platform', description: 'Core' },
      'org-1',
    );
  });

  it('lists projects with role-based filtering', async () => {
    projectsServiceMock.findAll.mockResolvedValue([{ id: 'project-1' }]);

    await expect(
      controller.findAll('org-1', { id: 'user-1', role: Role.ADMIN }),
    ).resolves.toEqual([{ id: 'project-1' }]);
    expect(projectsServiceMock.findAll).toHaveBeenCalledWith('org-1', 'user-1', Role.ADMIN);
  });

  it('verifies access before returning project details', async () => {
    projectsServiceMock.verifyProjectAccess.mockResolvedValue({ id: 'project-1' });
    projectsServiceMock.findById.mockResolvedValue({ id: 'project-1', name: 'Platform' });

    await expect(
      controller.findOne('project-1', 'org-1', { id: 'user-1', role: Role.DEVELOPER }),
    ).resolves.toMatchObject({
      name: 'Platform',
    });
    expect(projectsServiceMock.verifyProjectAccess).toHaveBeenCalledWith(
      'project-1',
      'org-1',
      'user-1',
      Role.DEVELOPER,
    );
  });

  it('verifies access before returning project metrics', async () => {
    projectsServiceMock.verifyProjectAccess.mockResolvedValue({ id: 'project-1' });
    projectsServiceMock.getProjectMetrics.mockResolvedValue({ totalCommits: 5 });

    await expect(
      controller.getMetrics('project-1', 'org-1', { id: 'user-1', role: Role.TEAM_LEAD }),
    ).resolves.toEqual({ totalCommits: 5 });
    expect(projectsServiceMock.verifyProjectAccess).toHaveBeenCalledWith(
      'project-1',
      'org-1',
      'user-1',
      Role.TEAM_LEAD,
    );
  });
});
