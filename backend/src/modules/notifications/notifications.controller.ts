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

/**
 * Controller for managing user notifications
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get notifications for the current user
   * GET /api/notifications
   */
  @Get()
  async findAll(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
    @Query() filters: NotificationFiltersDto,
  ) {
    return this.notificationsService.findAll(userId, organizationId, filters);
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationsService.getUnreadCount(userId, organizationId);
  }

  /**
   * Get a single notification
   * GET /api/notifications/:id
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.notificationsService.findOne(id, userId);
  }

  /**
   * Mark a notification as read
   * PATCH /api/notifications/:id/read
   */
  @Patch(':id/read')
  async markAsRead(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  /**
   * Mark all notifications as read
   * POST /api/notifications/read-all
   */
  @Post('read-all')
  async markAllAsRead(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationsService.markAllAsRead(userId, organizationId);
  }

  /**
   * Delete a notification
   * DELETE /api/notifications/:id
   */
  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.notificationsService.delete(id, userId);
  }
}
