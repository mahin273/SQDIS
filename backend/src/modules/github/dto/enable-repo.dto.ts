/**eslint-disable */
import { IsString,IsNotEmpty, IsOptional, IsNumber } from "class-validator";
import { ApiProperty,ApiPropertyOptional } from "@nestjs/swagger";

/**
 * DTO for enabling repository tracking
 */
export class EnableRepoDto {
  @ApiProperty({
    description: 'GitHub repository ID',
    example: 123456789,
  })
  @IsNumber()
  @IsNotEmpty({ message: 'GitHub repository ID is required' })
  githubId: number;

  @ApiProperty({
    description: 'Repository name',
    example: 'my-repo',
  })
  @IsString()
  @IsNotEmpty({ message: 'Repository name is required' })
  name: string;

  @ApiProperty({
    description: 'Full repository name (owner/repo)',
    example: 'owner/my-repo',
  })
  @IsString()
  @IsNotEmpty({ message: 'Full repository name is required' })
  fullName: string;

  @ApiPropertyOptional({
    description: 'Whether to backfill commits from the last 90 days',
    default: true,
  })
  @IsOptional()
  backfill?: boolean = true;
}
