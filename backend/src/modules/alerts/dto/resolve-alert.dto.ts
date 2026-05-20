import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for resolving an alert
 */
export class ResolveAlertDto {
  @ApiProperty({ description: 'Notes explaining how the alert was resolved' })
  @IsNotEmpty()
  @IsString()
  resolutionNotes!: string;
}
