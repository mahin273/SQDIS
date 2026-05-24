import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * DTO for adding a new email alias
 */
export class AddAliasDto {
  @ApiProperty({
    description: 'Email address to add as an alias',
    example: 'developer@company.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
