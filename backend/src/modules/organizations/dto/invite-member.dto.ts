import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteMemberDto {
  /**
   * Email address of the person to invite
   * Example: "newmember@example.com"
   */
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}