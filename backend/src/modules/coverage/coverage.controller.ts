import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import { CoverageService } from './coverage.service';
import {
  CoverageFiltersDto,
  CoverageResponseDto,
  CoverageListResponseDto,
  CoverageTrendFiltersDto,
  CoverageTrendResponseDto,
} from './dto';
import { MAX_COVERAGE_FILE_SIZE } from './constants';

/**
 * Controller for coverage report endpoints
 */
@ApiTags('coverage')
@ApiBearerAuth()
@Controller('coverage')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class CoverageController {
  constructor(private readonly coverageService: CoverageService) {}

  /**
   * Upload a coverage report
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload a coverage report',
    description: `Upload a coverage report file for processing. The system supports multiple coverage formats and processes reports asynchronously.

**Supported Formats:**
- **LCOV**: Text-based format commonly used by C/C++ and JavaScript projects
- **Cobertura XML**: XML format used by Java, Python, and other languages
- **JaCoCo XML**: XML format specifically for Java projects with detailed metrics
- **NYC JSON**: JSON format from Istanbul/NYC for JavaScript/TypeScript projects

**Processing Flow:**
1. File is uploaded and validated (format, size, duplicates)
2. Report record is created with PENDING status
3. Background job is enqueued for parsing
4. Report status transitions to PROCESSING → COMPLETED or FAILED
5. Parsed data is stored and coverage delta is calculated

**Features:**
- Automatic format detection based on file content
- Duplicate detection using SHA-256 file hash
- Asynchronous processing for large files
- Coverage delta calculation compared to previous report
- Branch-aware delta calculation

**File Size Limit:** 50MB

**Authentication:** Requires valid JWT token. User must belong to the organization that owns the repository.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Coverage report file in one of the supported formats (LCOV, Cobertura XML, JaCoCo XML, NYC JSON)',
        },
        repositoryId: {
          type: 'string',
          description: 'UUID of the repository this coverage report belongs to',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        commitSha: {
          type: 'string',
          description:
            'Git commit SHA (40 hexadecimal characters) associated with this coverage report (optional)',
          example: 'abc123def456789012345678901234567890abcd',
        },
        branch: {
          type: 'string',
          description: 'Git branch name associated with this coverage report (optional)',
          example: 'main',
        },
      },
      required: ['file', 'repositoryId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Coverage report uploaded successfully and queued for processing',
    type: CoverageResponseDto,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repositoryId: '223e4567-e89b-12d3-a456-426614174001',
        format: 'COBERTURA',
        status: 'PENDING',
        originalFilename: 'coverage.xml',
        fileSize: 1024567,
        fileHash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        commitSha: 'abc123def456789012345678901234567890abcd',
        branch: 'main',
        createdAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input, unsupported format, or duplicate report',
    schema: {
      examples: {
        missingRepositoryId: {
          value: {
            statusCode: 400,
            message: 'Repository ID is required',
          },
        },
        unsupportedFormat: {
          value: {
            statusCode: 400,
            message:
              'Unable to detect coverage format. Supported formats: Cobertura XML, JaCoCo XML, NYC JSON, LCOV',
          },
        },
        duplicateReport: {
          value: {
            statusCode: 400,
            message: 'Duplicate coverage report already exists',
          },
        },
        invalidCommitSha: {
          value: {
            statusCode: 400,
            message: 'Invalid commit SHA format. Expected 40 hexadecimal characters',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not belong to the organization that owns the repository',
    schema: {
      example: {
        statusCode: 403,
        message: 'Forbidden resource',
      },
    },
  })
  @ApiResponse({
    status: 413,
    description: 'Payload too large - File exceeds 50MB limit',
    schema: {
      example: {
        statusCode: 413,
        message: 'File size exceeds maximum allowed size of 52428800 bytes',
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCoverage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_COVERAGE_FILE_SIZE })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Query('repositoryId') repositoryId: string,
    @Query('commitSha') commitSha: string,
    @Query('branch') branch: string,
    @GetOrganization() organizationId: string,
    @GetUser('id') userId: string,
  ): Promise<CoverageResponseDto> {
    if (!repositoryId) {
      throw new BadRequestException('Repository ID is required');
    }

    return this.coverageService.uploadCoverage(
      file,
      repositoryId,
      organizationId,
      userId,
      commitSha,
      branch,
    );
  }

  /**
   * List coverage reports
   */
  @Get()
  @ApiOperation({
    summary: 'List coverage reports',
    description: `Retrieve a paginated list of coverage reports with optional filtering.

**Features:**
- Filter by repository, status, format, branch, or commit SHA
- Filter by date range (startDate, endDate)
- Pagination support with configurable page size
- Returns reports with basic metrics and metadata

**Use Cases:**
- View all coverage reports for an organization
- Filter reports by repository or branch
- Track processing status of uploaded reports
- Search for reports by commit SHA

**Authentication:** Requires valid JWT token. User must belong to the organization.`,
  })
  @ApiQuery({
    name: 'repositoryId',
    required: false,
    description: 'Filter by repository UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    description: 'Filter by processing status',
    example: 'COMPLETED',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['LCOV', 'COBERTURA', 'NYC_JSON', 'JACOCO'],
    description: 'Filter by coverage format',
    example: 'COBERTURA',
  })
  @ApiQuery({
    name: 'branch',
    required: false,
    description: 'Filter by branch name',
    example: 'main',
    type: String,
  })
  @ApiQuery({
    name: 'commitSha',
    required: false,
    description: 'Filter by commit SHA',
    example: 'abc123def456789012345678901234567890abcd',
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter reports created on or after this date (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter reports created on or before this date (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (starts at 1)',
    example: 1,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (max 100)',
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Coverage reports retrieved successfully',
    type: CoverageListResponseDto,
    schema: {
      example: {
        reports: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            repositoryId: '223e4567-e89b-12d3-a456-426614174001',
            repository: {
              id: '223e4567-e89b-12d3-a456-426614174001',
              name: 'my-project',
              fullName: 'myorg/my-project',
            },
            format: 'COBERTURA',
            status: 'COMPLETED',
            originalFilename: 'coverage.xml',
            fileSize: 1024567,
            fileHash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
            commitSha: 'abc123def456789012345678901234567890abcd',
            branch: 'main',
            linesTotal: 5000,
            linesCovered: 3750,
            coveragePercentage: 75.0,
            previousCoveragePercentage: 72.5,
            coverageDelta: 2.5,
            createdAt: '2024-01-15T10:30:00Z',
            processedAt: '2024-01-15T10:30:45Z',
          },
          {
            id: '223e4567-e89b-12d3-a456-426614174002',
            repositoryId: '223e4567-e89b-12d3-a456-426614174001',
            repository: {
              id: '223e4567-e89b-12d3-a456-426614174001',
              name: 'my-project',
              fullName: 'myorg/my-project',
            },
            format: 'JACOCO',
            status: 'COMPLETED',
            originalFilename: 'jacoco.xml',
            fileSize: 2048123,
            fileHash: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567',
            commitSha: 'def456abc789012345678901234567890abcdef',
            branch: 'develop',
            linesTotal: 4800,
            linesCovered: 3600,
            coveragePercentage: 75.0,
            previousCoveragePercentage: 74.2,
            coverageDelta: 0.8,
            createdAt: '2024-01-14T15:20:00Z',
            processedAt: '2024-01-14T15:21:10Z',
          },
        ],
        total: 42,
        page: 1,
        limit: 20,
        totalPages: 3,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  async findAll(
    @Query() filters: CoverageFiltersDto,
    @GetOrganization() organizationId: string,
  ): Promise<CoverageListResponseDto> {
    return this.coverageService.findAll(organizationId, filters);
  }

  /**
   * Get coverage report by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get coverage report by ID',
    description: `Retrieve a specific coverage report by its unique identifier.

**Features:**
- Returns complete report details including metrics
- Includes repository information
- Includes module-level coverage data when available
- Shows processing status and any error messages

**Use Cases:**
- View detailed coverage metrics for a specific report
- Check processing status of an uploaded report
- Retrieve module-level coverage breakdown
- Debug failed report processing

**Authentication:** Requires valid JWT token. User must belong to the organization that owns the repository.`,
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the coverage report',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Coverage report retrieved successfully',
    type: CoverageResponseDto,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repositoryId: '223e4567-e89b-12d3-a456-426614174001',
        repository: {
          id: '223e4567-e89b-12d3-a456-426614174001',
          name: 'my-project',
          fullName: 'myorg/my-project',
        },
        format: 'COBERTURA',
        status: 'COMPLETED',
        originalFilename: 'coverage.xml',
        fileSize: 1024567,
        fileHash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        commitSha: 'abc123def456789012345678901234567890abcd',
        branch: 'main',
        linesTotal: 5000,
        linesCovered: 3750,
        coveragePercentage: 75.0,
        previousCoveragePercentage: 72.5,
        coverageDelta: 2.5,
        createdAt: '2024-01-15T10:30:00Z',
        processedAt: '2024-01-15T10:30:45Z',
        modules: [
          {
            id: '323e4567-e89b-12d3-a456-426614174003',
            modulePath: 'src/services/user.service.ts',
            linesTotal: 250,
            linesCovered: 200,
            coveragePercentage: 80.0,
          },
          {
            id: '423e4567-e89b-12d3-a456-426614174004',
            modulePath: 'src/controllers/auth.controller.ts',
            linesTotal: 180,
            linesCovered: 135,
            coveragePercentage: 75.0,
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not belong to the organization that owns the repository',
    schema: {
      example: {
        statusCode: 403,
        message: 'Forbidden resource',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Coverage report not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Coverage report not found',
      },
    },
  })
  async findById(
    @Param('id') id: string,
    @GetOrganization() organizationId: string,
  ): Promise<CoverageResponseDto> {
    return this.coverageService.findById(id, organizationId);
  }

  /**
   * Get latest coverage report for a repository
   */
  @Get('latest/:repositoryId')
  @ApiOperation({
    summary: 'Get latest coverage report for a repository',
    description: `Retrieve the most recent completed coverage report for a specific repository.

**Features:**
- Returns the latest COMPLETED report only
- Includes complete metrics and module data
- Useful for displaying current coverage status
- Filters by repository and organization

**Use Cases:**
- Display current coverage on repository dashboard
- Show latest coverage badge/status
- Compare current coverage with historical data
- Quick access to most recent metrics

**Authentication:** Requires valid JWT token. User must belong to the organization that owns the repository.`,
  })
  @ApiParam({
    name: 'repositoryId',
    description: 'UUID of the repository',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Latest coverage report retrieved successfully',
    type: CoverageResponseDto,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repositoryId: '223e4567-e89b-12d3-a456-426614174001',
        repository: {
          id: '223e4567-e89b-12d3-a456-426614174001',
          name: 'my-project',
          fullName: 'myorg/my-project',
        },
        format: 'NYC_JSON',
        status: 'COMPLETED',
        originalFilename: 'coverage-final.json',
        fileSize: 512345,
        fileHash: 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
        commitSha: '789012def456abc345678901234567890abcdef',
        branch: 'main',
        linesTotal: 8500,
        linesCovered: 6800,
        coveragePercentage: 80.0,
        previousCoveragePercentage: 78.5,
        coverageDelta: 1.5,
        createdAt: '2024-01-17T09:15:00Z',
        processedAt: '2024-01-17T09:15:30Z',
        modules: [
          {
            id: '523e4567-e89b-12d3-a456-426614174005',
            modulePath: 'src/utils/helpers.ts',
            linesTotal: 120,
            linesCovered: 108,
            coveragePercentage: 90.0,
          },
          {
            id: '623e4567-e89b-12d3-a456-426614174006',
            modulePath: 'src/models/user.model.ts',
            linesTotal: 200,
            linesCovered: 150,
            coveragePercentage: 75.0,
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not belong to the organization that owns the repository',
    schema: {
      example: {
        statusCode: 403,
        message: 'Forbidden resource',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No coverage reports found for repository',
    schema: {
      example: {
        statusCode: 404,
        message: 'No coverage reports found for repository',
      },
    },
  })
  async findLatest(
    @Param('repositoryId') repositoryId: string,
    @GetOrganization() organizationId: string,
  ): Promise<CoverageResponseDto> {
    return this.coverageService.findLatest(repositoryId, organizationId);
  }

  /**
   * Get coverage trends for a repository
   */
  @Get('trends/:repositoryId')
  @ApiOperation({
    summary: 'Get coverage trends for a repository',
    description: `Retrieve coverage trend analysis for a repository over time. Returns coverage reports ordered chronologically with trend statistics.
    
**Features:**
- Filter by branch name to analyze specific branches
- Filter by date range to focus on specific time periods
- Limit results for pagination
- Includes trend statistics (min, max, average, trend direction)

**Use Cases:**
- Track coverage improvements or regressions over time
- Compare coverage across different branches
- Analyze coverage trends for specific time periods
- Monitor team testing practices

**Authentication:** Requires valid JWT token. User must belong to the organization that owns the repository.`,
  })
  @ApiParam({
    name: 'repositoryId',
    description: 'UUID of the repository to get trends for',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  @ApiQuery({
    name: 'branch',
    required: false,
    description: 'Filter trends by branch name (e.g., "main", "develop", "feature/new-feature")',
    example: 'main',
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description:
      'Filter trends from this date (ISO 8601 format). Only reports created on or after this date will be included.',
    example: '2024-01-01T00:00:00Z',
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description:
      'Filter trends until this date (ISO 8601 format). Only reports created on or before this date will be included.',
    example: '2024-12-31T23:59:59Z',
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of reports to return. Defaults to 100. Must be between 1 and 500.',
    example: 100,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Coverage trends retrieved successfully',
    type: CoverageTrendResponseDto,
    schema: {
      example: {
        reports: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            coveragePercentage: 75.5,
            coverageDelta: 2.3,
            commitSha: 'abc123def456789012345678901234567890abcd',
            branch: 'main',
            createdAt: '2024-01-15T10:30:00Z',
          },
          {
            id: '223e4567-e89b-12d3-a456-426614174001',
            coveragePercentage: 77.8,
            coverageDelta: 2.3,
            commitSha: 'def456abc789012345678901234567890abcdef',
            branch: 'main',
            createdAt: '2024-01-16T14:20:00Z',
          },
          {
            id: '323e4567-e89b-12d3-a456-426614174002',
            coveragePercentage: 79.2,
            coverageDelta: 1.4,
            commitSha: '789012def456abc345678901234567890abcdef',
            branch: 'main',
            createdAt: '2024-01-17T09:15:00Z',
          },
        ],
        statistics: {
          min: 75.5,
          max: 79.2,
          average: 77.5,
          trend: 'improving',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not belong to the organization that owns the repository',
    schema: {
      example: {
        statusCode: 403,
        message: 'Forbidden resource',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Repository not found',
      },
    },
  })
  async getCoverageTrends(
    @Param('repositoryId') repositoryId: string,
    @Query() filters: CoverageTrendFiltersDto,
    @GetOrganization() organizationId: string,
  ): Promise<CoverageTrendResponseDto> {
    return this.coverageService.getCoverageTrends(repositoryId, organizationId, filters);
  }
}
