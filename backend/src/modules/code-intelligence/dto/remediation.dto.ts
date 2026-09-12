import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray } from 'class-validator';

export class RemediationRequestDto {
  @ApiProperty({
    description: 'Source code snippet to analyze for refactoring and remediation',
    example: 'function process(order) {\n  if (order) {\n    if (order.valid) {\n      return true;\n    }\n  }\n}',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    description: 'Programming language: typescript, javascript, or python',
    example: 'typescript',
    default: 'typescript',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Optional file path for contextual attribution',
    example: 'src/services/order.service.ts',
  })
  @IsOptional()
  @IsString()
  filePath?: string;

  @ApiPropertyOptional({
    description: 'Observed cyclomatic complexity if already calculated',
    example: 14,
  })
  @IsOptional()
  @IsNumber()
  cyclomaticComplexity?: number;
}

export class RemediationRecipeDto {
  @ApiProperty({
    description: 'Code smell identifier',
    example: 'DEEP_NESTING',
  })
  @IsString()
  smellType: string;

  @ApiProperty({
    description: 'Descriptive title of the code smell and remedy',
    example: 'Deeply Nested Conditionals (Arrow Anti-Pattern)',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Severity: CRITICAL, WARNING, or SUGGESTION',
    example: 'WARNING',
  })
  @IsString()
  severity: 'CRITICAL' | 'WARNING' | 'SUGGESTION';

  @ApiProperty({
    description: 'Canonical refactoring pattern',
    example: 'Guard Clause Inversion',
  })
  @IsString()
  recommendedStrategy: string;

  @ApiProperty({
    description: 'Estimated reduction in cyclomatic complexity percentage',
    example: 45,
  })
  @IsNumber()
  estimatedComplexityReductionPct: number;

  @ApiProperty({
    description: 'Detailed explanation of why this pattern is problematic',
    example: 'Deep nesting creates excessive cognitive load and increases the risk of regressions during maintenance.',
  })
  @IsString()
  explanation: string;

  @ApiProperty({
    description: 'Step-by-step refactoring instructions',
    type: [String],
    example: [
      'Invert the outermost conditional condition',
      'Return early if the precondition is not satisfied',
      'Un-indent the remaining execution body',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  stepByStep: string[];

  @ApiProperty({
    description: 'Problematic code snippet before refactoring',
  })
  @IsString()
  beforeSnippet: string;

  @ApiProperty({
    description: 'Clean transformed code snippet after refactoring',
  })
  @IsString()
  afterSnippet: string;
}

export class RemediationResponseDto {
  @ApiPropertyOptional({
    description: 'File path evaluated',
    example: 'src/services/order.service.ts',
  })
  targetFilePath?: string;

  @ApiProperty({
    description: 'Total number of code smells diagnosed',
    example: 2,
  })
  totalSmellsFound: number;

  @ApiProperty({
    description: 'Overall refactoring potential score (100 = completely clean)',
    example: 72,
  })
  refactoringPotentialScore: number;

  @ApiProperty({
    description: 'List of prescriptive remediation recipes',
    type: [RemediationRecipeDto],
  })
  recipes: RemediationRecipeDto[];
}
