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
import { EmailAliasesService } from './email-aliases.service';
import { AddAliasDto } from './dto/add-alias.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

/**
 * Controller for email alias management
 */
@ApiTags('Email Aliases')
@Controller('email-aliases')
export class EmailAliasesController {
  constructor(private readonly emailAliasesService: EmailAliasesService) {}

  /**
   * Add a new email alias
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new email alias' })
  @ApiResponse({
    status: 201,
    description: 'Email alias created and verification email sent',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email format or email matches primary email',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already claimed by another user',
  })
  async addAlias(
    @Body() dto: AddAliasDto,
    @GetUser('id') userId: string,
    @GetUser('email') userEmail: string,
  ) {
    return this.emailAliasesService.addAlias(dto.email, userId, userEmail);
  }

  /**
   * Get all email aliases for the current user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all email aliases for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of email aliases with verification status',
  })
  async getAliases(@GetUser('id') userId: string) {
    return this.emailAliasesService.getAliasesByUserId(userId);
  }

  /**
   * Verify an email alias using the verification token
   * This endpoint is PUBLIC - no authentication required
   * Users click verification links from their email
   */
  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify an email alias (public endpoint)' })
  @ApiParam({ name: 'token', description: 'Verification token from email' })
  @ApiResponse({
    status: 200,
    description: 'Email alias verified successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Email alias already verified',
  })
  @ApiResponse({
    status: 404,
    description: 'Invalid verification token',
  })
  @ApiResponse({
    status: 410,
    description: 'Verification token has expired. Use resend endpoint to get a new token.',
  })
  async verifyAlias(@Param('token') token: string) {
    return this.emailAliasesService.verifyAlias(token);
  }

  /**
   * Resend verification email for a pending alias
   */
  @Post(':id/resend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiParam({ name: 'id', description: 'Email alias ID' })
  @ApiResponse({
    status: 200,
    description:
      'Verification email resent successfully. New token generated, old token invalidated.',
  })
  @ApiResponse({
    status: 400,
    description: 'Email alias is already verified',
  })
  @ApiResponse({
    status: 403,
    description: 'Email alias does not belong to the user',
  })
  @ApiResponse({
    status: 404,
    description: 'Email alias not found',
  })
  async resendVerification(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.emailAliasesService.resendVerification(id, userId);
  }

  /**
   * Remove an email alias
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an email alias' })
  @ApiParam({ name: 'id', description: 'Email alias ID' })
  @ApiResponse({
    status: 204,
    description: 'Email alias removed successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Email alias does not belong to the user',
  })
  @ApiResponse({
    status: 404,
    description: 'Email alias not found',
  })
  async removeAlias(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.emailAliasesService.removeAlias(id, userId);
  }
}
