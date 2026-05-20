import { IsString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DebtMarker } from '@prisma/client';

/**
 * DTO for creating a debt item
 */
export class CreateDebtItemDto {
  @ApiProperty({ description: 'Repository ID' })
  @IsUUID()
  repositoryId!: string;

  @ApiPropertyOptional({ description: 'Commit ID that introduced the debt' })
  @IsUUID()
  @IsOptional()
  commitId?: string;

  @ApiPropertyOptional({ description: 'Author ID who introduced the debt' })
  @IsUUID()
  @IsOptional()
  authorId?: string;

  @ApiProperty({ description: 'Type of debt marker', enum: DebtMarker })
  @IsEnum(DebtMarker)
  markerType!: DebtMarker;

  @ApiProperty({ description: 'Content of the debt marker' })
  @IsString()
  content!: string;

  @ApiProperty({ description: 'File path where the debt was found' })
  @IsString()
  filePath!: string;

  @ApiProperty({ description: 'Line number where the debt was found', minimum: 1 })
  @IsInt()
  @Min(1)
  lineNumber!: number;
}
