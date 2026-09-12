import { IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQualityGatePolicyDto {
  @ApiPropertyOptional({
    description: 'Defect probability threshold for WARNING status (0.0 to 1.0)',
    default: 0.4,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  warningDefectProbability?: number;

  @ApiPropertyOptional({
    description: 'Defect probability threshold for BLOCKED status (0.0 to 1.0)',
    default: 0.65,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  blockedDefectProbability?: number;

  @ApiPropertyOptional({
    description: 'Peak cyclomatic complexity threshold for WARNING status',
    default: 15,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  warningComplexity?: number;

  @ApiPropertyOptional({
    description: 'Peak cyclomatic complexity threshold for BLOCKED status',
    default: 25,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  blockedComplexity?: number;

  @ApiPropertyOptional({
    description: 'Whether to immediately mark PR as BLOCKED on security violations',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  blockOnSecurity?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the bot should post or update idempotent markdown comments on GitHub PRs',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enableBotComment?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the bot should publish commit status checks to GitHub',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enableCommitStatus?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, WARNING status marks GitHub commit check as failure; when false, marks as success',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  strictBranchProtection?: boolean;
}
