import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ThresholdConfigService } from './services/threshold-config.service';
import { AlertType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AlertsController Tenant Context Isolation', () => {
  let controller: AlertsController;
  let alertsService: jest.Mocked<Partial<AlertsService>>;
  let thresholdConfigService: jest.Mocked<Partial<ThresholdConfigService>>;

  beforeEach(async () => {
    alertsService = {
      findAll: jest.fn().mockResolvedValue({ alerts: [], total: 0 } as any),
      findById: jest.fn().mockResolvedValue({ id: 'alert-1', organizationId: 'active-org' } as any),
      acknowledge: jest.fn().mockResolvedValue({ id: 'alert-1' } as any),
      resolve: jest.fn().mockResolvedValue({ id: 'alert-1' } as any),
      getPreferences: jest.fn().mockResolvedValue({} as any),
      updatePreferences: jest.fn().mockResolvedValue({} as any),
    };

    thresholdConfigService = {
      getAllConfigs: jest.fn().mockResolvedValue([]),
      getConfig: jest.fn().mockResolvedValue({} as any),
      upsertConfig: jest.fn().mockResolvedValue({} as any),
      updateConfig: jest.fn().mockResolvedValue({} as any),
      resetConfig: jest.fn().mockResolvedValue({} as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        { provide: AlertsService, useValue: alertsService },
        { provide: ThresholdConfigService, useValue: thresholdConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  const mockRequest = {
    user: { id: 'user-1', organizationId: 'stale-jwt-org' },
    organizationId: 'active-switched-org',
    headers: { 'x-organization-id': 'active-switched-org' },
  };

  it('findAll queries using active organizationId', async () => {
    await controller.findAll(mockRequest, {});
    expect(alertsService.findAll).toHaveBeenCalledWith('active-switched-org', {});
  });

  it('getAllThresholdConfigs queries using active organizationId', async () => {
    await controller.getAllThresholdConfigs(mockRequest);
    expect(thresholdConfigService.getAllConfigs).toHaveBeenCalledWith('active-switched-org');
  });

  it('getThresholdConfig queries using active organizationId', async () => {
    await controller.getThresholdConfig(mockRequest, AlertType.ANOMALY);
    expect(thresholdConfigService.getConfig).toHaveBeenCalledWith(
      'active-switched-org',
      AlertType.ANOMALY,
    );
  });

  it('upsertThresholdConfig passes active organizationId', async () => {
    const dto = { alertType: AlertType.ANOMALY, warningThreshold: 10, criticalThreshold: 20 };
    await controller.upsertThresholdConfig(mockRequest, dto as any);
    expect(thresholdConfigService.upsertConfig).toHaveBeenCalledWith(
      'active-switched-org',
      dto,
      'user-1',
    );
  });

  it('findById scopes lookup to active organizationId', async () => {
    await controller.findById(mockRequest, 'alert-1');
    expect(alertsService.findById).toHaveBeenCalledWith('alert-1', 'active-switched-org');
  });

  it('acknowledge passes active organizationId', async () => {
    await controller.acknowledge(mockRequest, 'alert-1', {});
    expect(alertsService.acknowledge).toHaveBeenCalledWith('alert-1', 'user-1', 'active-switched-org');
  });

  it('resolve passes active organizationId', async () => {
    await controller.resolve(mockRequest, 'alert-1', { resolutionNotes: 'Fixed' });
    expect(alertsService.resolve).toHaveBeenCalledWith(
      'alert-1',
      'user-1',
      'active-switched-org',
      'Fixed',
    );
  });
});
