/* eslint-disable */
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for switching organization context
 */
export class SwitchOrganizationDto {
  @ApiProperty({
    description: 'ID of the organization to switch to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Organization ID is required' })
  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  organizationId: string;
}
