import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for assigning a repository to a project
 */
export class AssignRepositoryDto {
  @ApiProperty({
    description: 'Repository ID or identifier to assign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  repositoryId!: string;
}
