import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for assigning a team to a project
 */
export class AssignTeamDto {
  @ApiProperty({
    description: 'Team ID to assign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teamId!: string;
}
