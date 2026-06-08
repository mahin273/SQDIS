import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TeamLeadOrAdminGuard } from '../auth/guards/team-lead-or-admin.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

describe('TeamsController', () => {
  let controller: TeamsController;
  const teamsServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    assignLead: jest.fn(),
    getMetrics: jest.fn(),
    getLeaderboard: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        { provide: TeamsService, useValue: teamsServiceMock },
        { provide: OrganizationsService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(TeamLeadOrAdminGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TeamsController>(TeamsController);
    jest.clearAllMocks();
  });

  it('requires an organization id when creating a team', async () => {
    await expect(
      controller.create({ name: 'Backend' }, 'user-1', ''),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(teamsServiceMock.create).not.toHaveBeenCalled();
  });

  it('creates a team for the current organization', async () => {
    teamsServiceMock.create.mockResolvedValue({ id: 'team-1', name: 'Backend' });

    await expect(
      controller.create({ name: 'Backend' }, 'user-1', 'org-1'),
    ).resolves.toMatchObject({ id: 'team-1' });
    expect(teamsServiceMock.create).toHaveBeenCalledWith({ name: 'Backend' }, 'org-1');
  });

  it('requires an organization id when listing teams', async () => {
    await expect(
      controller.findAll('', { id: 'user-1', role: Role.ADMIN }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists teams with role-based filtering', async () => {
    teamsServiceMock.findAll.mockResolvedValue([{ id: 'team-1' }]);

    await expect(
      controller.findAll('org-1', { id: 'user-1', role: Role.DEVELOPER }),
    ).resolves.toEqual([{ id: 'team-1' }]);
    expect(teamsServiceMock.findAll).toHaveBeenCalledWith('org-1', 'user-1', Role.DEVELOPER);
  });
});
