import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DevelopersService } from './developers.service';
import { JwtAuthGuard } from '../auth/guards';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Developers')
@ApiBearerAuth()
@Controller('developers')
@UseGuards(JwtAuthGuard)
export class DevelopersController {
  constructor(private readonly developersService: DevelopersService) {}

  /**
   * Get all developers for the organization
   */
  @Get()
  @ApiOperation({ summary: 'Get all developers for the organization' })
  @ApiResponse({ status: 200, description: 'Developers list retrieved successfully.' })
  async getDevelopers(
    @GetOrganization() organizationId: string | undefined,
    @GetUser() user: any,
  ) {
    const orgId = organizationId || user?.organizationId;
    return this.developersService.getDevelopers(orgId);
  }

  /**
   * Get developer profile by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get developer profile by ID' })
  @ApiParam({ name: 'id', description: 'Developer User UUID' })
  @ApiResponse({ status: 200, description: 'Developer profile retrieved.' })
  @ApiResponse({ status: 404, description: 'Developer not found in organization.' })
  async getDeveloperById(
    @Param('id', ParseUUIDPipe) id: string,
    @GetOrganization() organizationId: string | undefined,
    @GetUser() user: any,
  ) {
    const orgId = organizationId || user?.organizationId;
    return this.developersService.getDeveloperById(id, orgId);
  }

  /**
   * Get developer stats and analytics
   */
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get developer analytics, DQS trends, and recent commits' })
  @ApiParam({ name: 'id', description: 'Developer User UUID' })
  @ApiResponse({ status: 200, description: 'Developer stats retrieved.' })
  @ApiResponse({ status: 404, description: 'Developer not found in organization.' })
  async getDeveloperStats(
    @Param('id', ParseUUIDPipe) id: string,
    @GetOrganization() organizationId: string | undefined,
    @GetUser() user: any,
  ) {
    const orgId = organizationId || user?.organizationId;
    return this.developersService.getDeveloperStats(id, orgId);
  }
}
