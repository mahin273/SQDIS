import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { EnhancedAuditLogService } from '../services/enhanced-audit-log.service';

describe('AuditLogInterceptor Tenant Attribution', () => {
  let interceptor: AuditLogInterceptor;
  let reflector: jest.Mocked<Partial<Reflector>>;
  let auditLogService: jest.Mocked<Partial<EnhancedAuditLogService>>;

  beforeEach(async () => {
    reflector = {
      get: jest.fn(),
    };

    auditLogService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogInterceptor,
        { provide: Reflector, useValue: reflector },
        { provide: EnhancedAuditLogService, useValue: auditLogService },
      ],
    }).compile();

    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
  });

  const createMockContext = (req: any) => {
    return {
      getHandler: jest.fn().mockReturnValue({}),
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
    } as any;
  };

  it('attributes audit entry to request.organizationId rather than user.organizationId', async () => {
    reflector.get!.mockReturnValue({
      action: 'UPDATE',
      resourceType: 'AlertThresholdConfig',
    });

    const mockRequest = {
      user: { id: 'user-1', organizationId: 'default-jwt-org' },
      organizationId: 'validated-active-org',
      headers: { 'x-organization-id': 'validated-active-org' },
      params: {},
    };

    const next = {
      handle: () => of({ success: true }),
    };

    const stream$ = interceptor.intercept(createMockContext(mockRequest), next);
    await firstValueFrom(stream$);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(auditLogService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'validated-active-org',
        action: 'UPDATE',
        resourceType: 'AlertThresholdConfig',
      }),
    );
  });

  it('falls back to user.organizationId when request.organizationId is not set', async () => {
    reflector.get!.mockReturnValue({
      action: 'CREATE',
      resourceType: 'Goal',
    });

    const mockRequest = {
      user: { id: 'user-1', organizationId: 'default-jwt-org' },
      headers: {},
      params: {},
    };

    const next = {
      handle: () => of({ id: 'goal-1' }),
    };

    const stream$ = interceptor.intercept(createMockContext(mockRequest), next);
    await firstValueFrom(stream$);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(auditLogService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'default-jwt-org',
        action: 'CREATE',
        resourceType: 'Goal',
      }),
    );
  });

  it('skips audit logging when method has no @AuditLog metadata', async () => {
    reflector.get!.mockReturnValue(undefined);

    const mockRequest = {
      user: { id: 'user-1', organizationId: 'org-1' },
      headers: {},
      params: {},
    };

    const next = {
      handle: () => of({ success: true }),
    };

    const stream$ = interceptor.intercept(createMockContext(mockRequest), next);
    const result = await firstValueFrom(stream$);

    expect(result).toEqual({ success: true });
    expect(auditLogService.logAction).not.toHaveBeenCalled();
  });

  it('captures request and response payloads when configured', async () => {
    reflector.get!.mockReturnValue({
      action: 'CREATE',
      resourceType: 'Project',
      includeRequestBody: true,
      includeResponseBody: true,
    });

    const mockRequest = {
      user: { id: 'user-1', organizationId: 'org-1' },
      organizationId: 'org-1',
      headers: { 'user-agent': 'Jest-Agent' },
      body: { name: 'New Project' },
      params: {},
      ip: '127.0.0.1',
    };

    const next = {
      handle: () => of({ id: 'proj-1', name: 'New Project' }),
    };

    const stream$ = interceptor.intercept(createMockContext(mockRequest), next);
    await firstValueFrom(stream$);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(auditLogService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        resourceType: 'Project',
        metadata: {
          requestBody: { name: 'New Project' },
          responseBody: { id: 'proj-1', name: 'New Project' },
        },
      }),
    );
  });
});
