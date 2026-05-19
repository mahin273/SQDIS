import { IsString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { DebtMarker } from '@prisma/client';

/**
 * DTO for creating a debt item
 */
export class CreateDebtItemDto {
  @IsUUID()
  repositoryId!: string;

  @IsUUID()
  @IsOptional()
  commitId?: string;

  @IsUUID()
  @IsOptional()
  authorId?: string;

  @IsEnum(DebtMarker)
  markerType!: DebtMarker;

  @IsString()
  content!: string;

  @IsString()
  filePath!: string;

  @IsInt()
  @Min(1)
  lineNumber!: number;
}
