import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRemovalRequestDto {
  @ApiProperty({ description: 'User ID of the member to remove' })
  @IsNotEmpty()
  @IsString()
  targetUserId: string;

  @ApiPropertyOptional({ description: 'Reason for requesting member removal' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
