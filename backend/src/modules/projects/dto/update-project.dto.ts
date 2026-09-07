import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating a project
 */
export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: 'Project name',
    example: 'E-Commerce Platform v2',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Updated e-commerce platform with new features',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Project key',
    example: 'CORE',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  key?: string;

  @ApiPropertyOptional({
    description: 'Project badge color',
    example: '#3b82f6',
  })
  @IsString()
  @IsOptional()
  color?: string;
}
