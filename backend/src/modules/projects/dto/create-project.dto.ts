import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new project
 */
export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'E-Commerce Platform',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Main e-commerce platform with payment integration',
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
