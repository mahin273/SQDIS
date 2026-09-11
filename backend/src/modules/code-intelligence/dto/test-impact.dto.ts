import { IsArray, IsOptional, IsString, IsObject } from 'class-validator';

export class TestImpactDto {
  @IsOptional()
  @IsString()
  repositoryRoot?: string;

  @IsArray()
  @IsString({ each: true })
  changedFiles: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  testFiles?: string[];

  @IsOptional()
  @IsObject()
  fileContents?: Record<string, string>;
}
