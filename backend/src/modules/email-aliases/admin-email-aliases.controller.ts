import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AdminEmailAliasesService } from './services/admin-email-aliases.service';
import { AssignAliasDto } from './dto/assign-alias.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';

/**
 * Controller for admin email alias management
 */
@ApiTags('Admin Email Aliases')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminEmailAliasesController {
  constructor(private readonly adminEmailAliasesService: AdminEmailAliasesService) {}

  /**
   * Get all unmapped emails for the organization
   */
  @Get('unmapped-emails')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Get all unmapped emails in the organization' })
  @ApiResponse({
    status: 200,
    description: 'List of unmapped emails sorted by commit count descending',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have admin privileges',
  })
  async getUnmappedEmails(@GetOrganization() organizationId: string) {
    return this.adminEmailAliasesService.getUnmappedEmails(organizationId);
  }

  /**
   * Assign an email to a user (admin only)
   */
  @Post('email-aliases/assign')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Assign an email to a user without verification' })
  @ApiResponse({
    status: 201,
    description: 'Email assigned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'User does not belong to this organization',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have admin privileges',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already claimed',
  })
  async assignEmail(
    @Body() dto: AssignAliasDto,
    @GetUser('id') adminId: string,
    @GetOrganization() organizationId: string,
  ) {
    return this.adminEmailAliasesService.assignEmailToUser(
      dto.email,
      dto.userId,
      adminId,
      organizationId,
    );
  }

  /**
   * Remove an email mapping (admin only)
   */
  @Delete('email-aliases/:id')
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an email mapping' })
  @ApiParam({ name: 'id', description: 'Email alias ID' })
  @ApiResponse({
    status: 204,
    description: 'Email mapping removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot remove primary email or email does not belong to organization',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have admin privileges',
  })
  @ApiResponse({
    status: 404,
    description: 'Email alias not found',
  })
  async removeEmailMapping(
    @Param('id') aliasId: string,
    @GetUser('id') adminId: string,
    @GetOrganization() organizationId: string,
  ) {
    return this.adminEmailAliasesService.removeEmailMapping(aliasId, adminId, organizationId);
  }
}
