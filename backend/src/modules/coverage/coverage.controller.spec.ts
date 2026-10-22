import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CoverageController } from './coverage.controller';
import { CoverageService } from './coverage.service';
import { CoverageFormat, CoverageStatus } from './constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';

describe('CoverageController', () => {
  let controller: CoverageController;
  let coverageService: jest.Mocked<CoverageService>;

  beforeEach(async () => {
    coverageService = {
      uploadCoverage: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      getTrends: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoverageController],
      providers: [
        {
          provide: CoverageService,
          useValue: coverageService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CoverageController>(CoverageController);
  });

  describe('uploadCoverage', () => {
    it('throws BadRequestException when repositoryId is missing', async () => {
      const mockFile = {
        path: '/tmp/test.lcov',
        originalname: 'test.lcov',
        size: 500,
      } as Express.Multer.File;

      await expect(
        controller.uploadCoverage(
          mockFile,
          '',
          'sha12345678901234567890123456789012345678',
          'main',
          'org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('delegates to coverageService.uploadCoverage with provided parameters', async () => {
      const mockFile = {
        path: '/tmp/coverage.xml',
        originalname: 'coverage.xml',
        size: 1024,
      } as Express.Multer.File;

      const expectedResponse = {
        id: 'report-123',
        repositoryId: 'repo-1',
        format: CoverageFormat.COBERTURA,
        status: CoverageStatus.PENDING,
        originalFilename: 'coverage.xml',
        fileSize: 1024,
        fileHash: 'dummy-hash',
        commitSha: '1234567890123456789012345678901234567890',
        branch: 'main',
        createdAt: new Date(),
      };

      coverageService.uploadCoverage.mockResolvedValueOnce(expectedResponse as any);

      const result = await controller.uploadCoverage(
        mockFile,
        'repo-1',
        '1234567890123456789012345678901234567890',
        'main',
        'org-1',
        'user-1',
      );

      expect(coverageService.uploadCoverage).toHaveBeenCalledWith(
        mockFile,
        'repo-1',
        'org-1',
        'user-1',
        '1234567890123456789012345678901234567890',
        'main',
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});
