import { IsString, IsOptional, IsNumber } from 'class-validator';

export class AstDefectDto {
  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsNumber()
  loc?: number;

  @IsOptional()
  @IsNumber()
  cyclomaticComplexity?: number;

  @IsOptional()
  @IsNumber()
  halsteadVolume?: number;

  @IsOptional()
  @IsNumber()
  halsteadDifficulty?: number;

  @IsOptional()
  @IsNumber()
  halsteadEffort?: number;
}
