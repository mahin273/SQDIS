import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateReleaseDto } from './dto/create-release.dto';
import { UpdateReleaseDto } from './dto/update-release.dto';
import {
  ReleaseResponseDto,
  ReadinessScoreDto,
  SprintSummaryDto,
} from './dto/release-response.dto';

/**
 * Service for release management
 */
@Injectable()
export class ReleasesService {
  private readonly logger = new Logger(ReleasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new release
   */
  async create(dto: CreateReleaseDto, organizationId: string) {
    // Check for duplicate version in the organization
    const existingRelease = await this.prisma.release.findFirst({
      where: {
        organizationId,
        version: dto.version,
        isActive: true,
      },
    });

    if (existingRelease) {
      throw new ConflictException(`Release version "${dto.version}" already exists`);
    }

    return this.prisma.release.create({
      data: {
        version: dto.version,
        targetDate: new Date(dto.targetDate),
        description: dto.description,
        organizationId,
        isActive: true,
      },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                team: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get all releases for an organization
   */
  async findAll(organizationId: string) {
    return this.prisma.release.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                team: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { targetDate: 'desc' },
    });
  }

  /**
   * Get release by ID
   */
  async findById(id: string): Promise<ReleaseResponseDto> {
    const release = await this.prisma.release.findUnique({
      where: { id },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                team: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    return this.formatReleaseResponse(release);
  }

  /**
   * Update release
   */
  async update(id: string, dto: UpdateReleaseDto) {
    const release = await this.prisma.release.findUnique({
      where: { id },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    const updateData: any = {};

    if (dto.version !== undefined) {
      // Check for duplicate version
      const existingRelease = await this.prisma.release.findFirst({
        where: {
          organizationId: release.organizationId,
          version: dto.version,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingRelease) {
        throw new ConflictException(`Release version "${dto.version}" already exists`);
      }

      updateData.version = dto.version;
    }

    if (dto.targetDate !== undefined) {
      updateData.targetDate = new Date(dto.targetDate);
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.shippedAt !== undefined) {
      updateData.shippedAt = new Date(dto.shippedAt);
    }

    return this.prisma.release.update({
      where: { id },
      data: updateData,
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                team: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Delete release (soft delete)
   */
  async delete(id: string) {
    const release = await this.prisma.release.findUnique({
      where: { id },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    return this.prisma.release.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Associate a sprint with a release
   */
  async associateSprint(releaseId: string, sprintId: string, organizationId: string) {
    // Verify release exists and belongs to organization
    const release = await this.prisma.release.findFirst({
      where: {
        id: releaseId,
        organizationId,
        isActive: true,
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    // Verify sprint exists and belongs to organization
    const sprint = await this.prisma.sprint.findFirst({
      where: {
        id: sprintId,
        organizationId,
        isActive: true,
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // Check if sprint is already associated with this release
    const existingAssociation = await this.prisma.releaseSprintAssociation.findUnique({
      where: {
        releaseId_sprintId: {
          releaseId,
          sprintId,
        },
      },
    });

    if (existingAssociation) {
      throw new ConflictException('Sprint is already associated with this release');
    }

    return this.prisma.releaseSprintAssociation.create({
      data: {
        releaseId,
        sprintId,
      },
      include: {
        sprint: {
          include: {
            team: {
              select: { name: true },
            },
          },
        },
      },
    });
  }

  /**
   * Remove sprint association from a release
   */
  async dissociateSprint(releaseId: string, sprintId: string, organizationId: string) {
    // Verify release exists and belongs to organization
    const release = await this.prisma.release.findFirst({
      where: {
        id: releaseId,
        organizationId,
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    const association = await this.prisma.releaseSprintAssociation.findUnique({
      where: {
        releaseId_sprintId: {
          releaseId,
          sprintId,
        },
      },
    });

    if (!association) {
      throw new NotFoundException('Sprint association not found');
    }

    return this.prisma.releaseSprintAssociation.delete({
      where: {
        releaseId_sprintId: {
          releaseId,
          sprintId,
        },
      },
    });
  }

  /**
   * Verify release access
   */
  async verifyReleaseAccess(releaseId: string, organizationId: string) {
    const release = await this.prisma.release.findFirst({
      where: {
        id: releaseId,
        organizationId,
      },
    });

    if (!release) {
      throw new ForbiddenException('Access denied to this release');
    }

    return release;
  }

  /**
   * Calculate release readiness score
   *
   * Weights:
   * - Bugs: 30%
   * - Coverage: 25%
   * - DQS: 25%
   * - Test pass rate: 20%
   */
  async calculateReadiness(releaseId: string): Promise<ReadinessScoreDto> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                reports: {
                  orderBy: { generatedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    // Aggregate metrics from all associated sprints
    let totalBugsIntroduced = 0;
    let totalBugsFixed = 0;
    let totalCoverage = 0;
    let totalDQS = 0;
    let sprintCount = 0;

    for (const association of release.sprintAssociations) {
      const report = association.sprint.reports[0];
      if (report) {
        totalBugsIntroduced += report.bugsIntroduced;
        totalBugsFixed += report.bugsFixed;
        totalCoverage += report.coveragePct;
        totalDQS += report.avgDQS;
        sprintCount++;
      }
    }

    // Calculate individual scores
    // Bug score: Higher is better when bugs fixed >= bugs introduced
    let bugScore = 100;
    if (totalBugsIntroduced > 0) {
      const bugRatio = totalBugsFixed / totalBugsIntroduced;
      bugScore = Math.min(100, Math.round(bugRatio * 100));
    }

    // Coverage score: Direct percentage
    const coverageScore = sprintCount > 0 ? Math.round(totalCoverage / sprintCount) : 0;

    // DQS score: Direct average
    const dqsScore = sprintCount > 0 ? Math.round(totalDQS / sprintCount) : 0;

    // Test pass rate: Placeholder (would come from CI/CD integration)
    // For now, estimate based on test commits ratio
    const testPassRate = 80; // Default placeholder

    // Calculate weighted score
    const score = bugScore * 0.3 + coverageScore * 0.25 + dqsScore * 0.25 + testPassRate * 0.2;

    const roundedScore = Math.round(score * 100) / 100;

    return {
      score: roundedScore,
      bugScore,
      coverageScore,
      dqsScore,
      testPassRate,
      isAtRisk: roundedScore < 70,
    };
  }

  /**
   * Format release response with sprint summaries
   */
  private formatReleaseResponse(release: any): ReleaseResponseDto {
    const sprints: SprintSummaryDto[] = release.sprintAssociations.map((assoc: any) => ({
      id: assoc.sprint.id,
      name: assoc.sprint.name,
      startDate: assoc.sprint.startDate,
      endDate: assoc.sprint.endDate,
      teamName: assoc.sprint.team.name,
    }));

    return {
      id: release.id,
      version: release.version,
      targetDate: release.targetDate,
      description: release.description,
      shippedAt: release.shippedAt,
      isActive: release.isActive,
      createdAt: release.createdAt,
      updatedAt: release.updatedAt,
      sprints,
    };
  }
}
