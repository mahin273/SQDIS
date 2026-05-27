import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationFiltersDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

/**
 * Controller for managing user notifications
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get notifications for the current user
   */
  @Get()
  @ApiOperation({ summary: 'Get user notifications with filters' })
  @ApiResponse({ status: 200, description: 'Notifications list retrieved successfully.' })
  async findAll(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
    @Query() filters: NotificationFiltersDto,
  ) {
    return this.notificationsService.findAll(userId, organizationId, filters);
  }

  /**
   * Get unread notification count
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread user notifications' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully.' })
  async getUnreadCount(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationsService.getUnreadCount(userId, organizationId);
  }

  /**
   * Get a single notification
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single notification detail by ID' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification details retrieved successfully.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.notificationsService.findOne(id, userId);
  }

  /**
   * Mark a notification as read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  async markAsRead(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  /**
   * Mark all notifications as read
   */
  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 201, description: 'All notifications successfully marked as read.' })
  async markAllAsRead(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationsService.markAllAsRead(userId, organizationId);
  }

  /**
   * Delete a notification
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification successfully deleted.' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.notificationsService.delete(id, userId);
  }
}
