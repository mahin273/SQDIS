import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * DTO for verifying an email alias
 */
export class VerifyAliasDto {
  @ApiProperty({
    description: 'Verification token received via email',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification token is required' })
  @Length(64, 64, { message: 'Invalid verification token format' })
  token!: string;
}
