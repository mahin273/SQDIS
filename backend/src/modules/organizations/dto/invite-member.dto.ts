/* eslint-disable */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email address of the person to invite',
    example: 'newmember@example.com',
  })
  /**
   * Email address of the person to invite
   * Example: "newmember@example.com"
   */
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}
