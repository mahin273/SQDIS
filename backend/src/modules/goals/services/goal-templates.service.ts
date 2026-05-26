import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { CreateGoalTemplateDto, UpdateGoalTemplateDto } from '../dto';

/**
 * Service for managing goal templates
 */
@Injectable()
export class GoalTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all goal templates for an organization
   */
  async findAll(organizationId: string) {
    const templates = await this.prisma.goalTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    // Get usage count for each template
    const templatesWithUsage = await Promise.all(
      templates.map(async (template) => {
        const usageCount = await this.prisma.goal.count({
          where: {
            organizationId,
            metricType: template.metricType,
            targetValue: template.targetValue,
          },
        });
        return { ...template, usageCount };
      }),
    );

    return templatesWithUsage;
  }

  /**
   * Get a specific goal template by ID
   */
  async findById(id: string, organizationId: string) {
    const template = await this.prisma.goalTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!template) {
      throw new NotFoundException(`Goal template with ID ${id} not found`);
    }

    return template;
  }

  /**
   * Create a new goal template
   */
  async create(organizationId: string, dto: CreateGoalTemplateDto) {
    // Check for duplicate name
    const existing = await this.prisma.goalTemplate.findFirst({
      where: {
        organizationId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(`Goal template with name "${dto.name}" already exists`);
    }

    return this.prisma.goalTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        metricType: dto.metricType,
        targetValue: dto.targetValue,
        operator: dto.operator,
        durationDays: dto.durationDays,
      },
    });
  }

  /**
   * Update a goal template
   */
  async update(id: string, organizationId: string, dto: UpdateGoalTemplateDto) {
    const template = await this.findById(id, organizationId);

    // Check for duplicate name if name is being updated
    if (dto.name && dto.name !== template.name) {
      const existing = await this.prisma.goalTemplate.findFirst({
        where: {
          organizationId,
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`Goal template with name "${dto.name}" already exists`);
      }
    }

    return this.prisma.goalTemplate.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a goal template (soft delete by removing)
   */
  async delete(id: string, organizationId: string) {
    await this.findById(id, organizationId);

    return this.prisma.goalTemplate.delete({
      where: { id },
    });
  }
}
