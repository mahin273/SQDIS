import { IsString, IsNotEmpty, IsInt, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PrFileOverrideDto {
  @ApiProperty({ description: 'File path' })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty({ description: 'File content (optional)', required: false })
  @IsString()
  @IsOptional()
  content?: string;
}

export class EvaluatePrQualityGateDto {
  @ApiProperty({ description: 'Repository ID' })
  @IsString()
  @IsNotEmpty()
  repositoryId: string;

  @ApiProperty({ description: 'Pull Request Number' })
  @IsInt()
  @IsNotEmpty()
  prNumber: number;

  @ApiProperty({ description: 'Head commit SHA (optional)', required: false })
  @IsString()
  @IsOptional()
  headCommitSha?: string;

  @ApiProperty({ description: 'Optional list of file overrides for direct CI/testing', required: false, type: [PrFileOverrideDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PrFileOverrideDto)
  files?: PrFileOverrideDto[];
}
