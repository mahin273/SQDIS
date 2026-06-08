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
});
