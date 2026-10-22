import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { createMockPrismaService, MockPrismaService } from '../../../test/mocks/prisma.mock';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrismaService() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: ProgressTrackingService,
          useValue: { calculateProgress: jest.fn().mockResolvedValue({ overallProgress: 50 }) },
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if user is not in organization', async () => {
      prisma.organizationMember.findFirst.mockResolvedValue(null);

      await expect(
        service.create('org-123', { userId: 'usr-456' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user already has active onboarding', async () => {
      prisma.organizationMember.findFirst.mockResolvedValue({ id: 'mem-1' });
      prisma.onboarding.findUnique.mockResolvedValue({
        id: 'onb-1',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
        checklistItems: [],
        milestones: [],
        user: { teamMemberships: [] },
      } as any);

      await expect(
        service.create('org-123', { userId: 'usr-456' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should create onboarding process successfully when user is valid', async () => {
      prisma.organizationMember.findFirst.mockResolvedValue({ id: 'mem-1' });
      
      const createdOnboarding = {
        id: 'onb-new-123',
        userId: 'usr-456',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        checklistItems: [],
        milestones: [],
        user: { id: 'usr-456', name: 'Test User', email: 'test@sqdis.dev', teamMemberships: [] },
      };
      
      // First call (check existing) returns null, second call (findById) returns created object
      prisma.onboarding.findUnique.mockResolvedValueOnce(null);
      prisma.onboarding.findFirst.mockResolvedValue(createdOnboarding as any);

      prisma.onboarding.create.mockResolvedValue(createdOnboarding as any);
      prisma.commit.count.mockResolvedValue(5);
      prisma.dQSScore.findFirst.mockResolvedValue(null);

      const result = await service.create('org-123', { userId: 'usr-456' } as any);

      expect(prisma.onboarding.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe('onb-new-123');
    });
  });

  describe('findById tenant scoping', () => {
    it('scopes findById query to organization membership when organizationId is provided', async () => {
      const mockOnboarding = {
        id: 'onb-1',
        userId: 'usr-1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        user: { teamMemberships: [] },
        milestones: [],
        checklistItems: [],
      };
      prisma.onboarding.findFirst.mockResolvedValue(mockOnboarding as any);
      prisma.commit.count.mockResolvedValue(2);
      prisma.dQSScore.findFirst.mockResolvedValue(null);

      const result = await service.findById('onb-1', 'org-123');

      expect(prisma.onboarding.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'onb-1',
            user: {
              organizationMembers: {
                some: { organizationId: 'org-123' },
              },
            },
          },
        }),
      );
      expect(result.id).toBe('onb-1');
    });

    it('throws NotFoundException when onboarding is not in the organization', async () => {
      prisma.onboarding.findFirst.mockResolvedValue(null);

      await expect(service.findById('onb-foreign', 'org-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTemplate tenant scoping', () => {
    it('scopes template lookup to organizationId', async () => {
      const mockTemplate = { id: 'tmpl-1', organizationId: 'org-123', name: 'Frontend' };
      prisma.onboardingTemplate.findFirst.mockResolvedValue(mockTemplate as any);

      const result = await service.getTemplate('tmpl-1', 'org-123');

      expect(prisma.onboardingTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tmpl-1', organizationId: 'org-123' },
      });
      expect(result).toEqual(mockTemplate);
    });

    it('throws NotFoundException when template does not belong to organization', async () => {
      prisma.onboardingTemplate.findFirst.mockResolvedValue(null);

      await expect(service.getTemplate('tmpl-foreign', 'org-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
