import { IsString, IsEnum, IsOptional, IsObject, IsUUID } from 'class-validator';
import { NotificationType } from '@prisma/client';

/**
 * DTO for creating a notification
 */
export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  organizationId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
