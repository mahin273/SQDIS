import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for creating a new team
 */
export class CreateTeamDto {
  @ApiProperty({
    description: 'Team name',
    example: 'Backend Team',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Team name is required' })
  @MinLength(1, { message: 'Team name must be at least 1 character long' })
  @MaxLength(100, { message: 'Team name must not exceed 100 characters' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Team description',
    example: 'Responsible for backend services and APIs',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;
}
