import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CommitRiskDto {
  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsNumber()
  addedLines: number;

  @IsNumber()
  deletedLines: number;

  @IsNumber()
  modifiedFilesCount: number;

  @IsOptional()
  @IsNumber()
  maxCyclomaticComplexity?: number;

  @IsOptional()
  @IsNumber()
  authorExperienceCommits?: number;

  @IsOptional()
  @IsNumber()
  directoryEntropy?: number;
}
