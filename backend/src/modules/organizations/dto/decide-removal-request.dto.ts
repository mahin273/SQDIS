import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideRemovalRequestDto {
  @ApiPropertyOptional({ description: 'Reason or notes for the decision' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  decisionReason?: string;
}
