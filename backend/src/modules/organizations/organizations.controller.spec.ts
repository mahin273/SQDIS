import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  const organizationsServiceMock = {
    create: jest.fn(),
    findAllForUser: jest.fn(),
    verifyUserRole: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getMembers: jest.fn(),
    createInvitation: jest.fn(),
    acceptInvitation: jest.fn(),
    getInvitationByToken: jest.fn(),
    resendInvitation: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    getRepositoryContributors: jest.fn(),
    inviteAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: organizationsServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getRepositoryContributors to organizationsService', async () => {
    const contributors = [
      {
        email: 'dev@example.com',
        name: 'Dev Example',
        commitCount: 10,
        lastCommittedAt: new Date(),
        repositories: ['SQDIS'],
        isMember: false,
        isInvited: false,
      },
    ];
    organizationsServiceMock.getRepositoryContributors.mockResolvedValueOnce(contributors);

    const result = await controller.getRepositoryContributors('org-1', 'user-1');
    expect(organizationsServiceMock.verifyUserRole).toHaveBeenCalledWith('org-1', 'user-1', expect.any(Array));
    expect(organizationsServiceMock.getRepositoryContributors).toHaveBeenCalledWith('org-1');
    expect(result).toBe(contributors);
  });

  it('delegates inviteAll to organizationsService', async () => {
    organizationsServiceMock.inviteAll.mockResolvedValueOnce({
      totalInvited: 2,
      emails: ['a@example.com', 'b@example.com'],
    });

    const result = await controller.inviteAll('org-1', 'user-1');
    expect(organizationsServiceMock.verifyUserRole).toHaveBeenCalledWith('org-1', 'user-1', expect.any(Array));
    expect(organizationsServiceMock.inviteAll).toHaveBeenCalledWith('org-1', 'user-1');
    expect(result).toEqual({
      totalInvited: 2,
      emails: ['a@example.com', 'b@example.com'],
    });
  });
});
