import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for associating a sprint with a release
 */
export class AssociateSprintDto {
  @ApiProperty({
    description: 'Sprint ID to associate with the release',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  sprintId!: string;
}
