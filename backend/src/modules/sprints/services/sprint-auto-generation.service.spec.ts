import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma';
import { SprintsService } from '../sprints.service';
import { SprintAutoGenerationService } from './sprint-auto-generation.service';

describe('SprintAutoGenerationService', () => {
  let service: SprintAutoGenerationService;
  let prisma: {
    sprint: {
      findMany: jest.Mock;
    };
    notification: {
      create: jest.Mock;
    };
  };
  let sprintsService: {
    generateReport: jest.Mock;
  };
  let eventEmitter: {
    emit: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      sprint: {
        findMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
    };
    sprintsService = {
      generateReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SprintAutoGenerationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SprintsService, useValue: sprintsService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<SprintAutoGenerationService>(SprintAutoGenerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerSprintEndCheck', () => {
    it('scopes ended sprints query by organizationId when provided', async () => {
      prisma.sprint.findMany.mockResolvedValue([]);

      const result = await service.triggerSprintEndCheck('org-tenant-1');

      expect(result).toEqual({ processed: 0 });
      expect(prisma.sprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            organizationId: 'org-tenant-1',
          }),
        }),
      );
    });

    it('queries all ended sprints when organizationId is omitted (system cron mode)', async () => {
      prisma.sprint.findMany.mockResolvedValue([]);

      const result = await service.triggerSprintEndCheck();

      expect(result).toEqual({ processed: 0 });
      expect(prisma.sprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            organizationId: expect.anything(),
          }),
        }),
      );
    });
  });
});
