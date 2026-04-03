/* eslint-disable */
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsNotEmpty } from "class-validator";

export class RegisterDto {
@ApiProperty({
  description: 'User email address',
  example: 'user@example.com',
})
@IsEmail({},{message: 'Invalid email format' })
@IsNotEmpty({ message: 'Email is required' })
email: string;

@ApiProperty({
  description: 'User password  (min 8 char,must contain uppercase,lowercase, and num)',
  example: 'SecurePass123',
  minLength: 8,
  maxLength: 128,
})
@IsString()
@IsNotEmpty({ message: 'Password is required' })
@MinLength(8, { message: 'Password must be at least 8 characters long' })
@MaxLength(128, { message: 'password must not exceed 128 char' })
@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,{
  message:
    'Password must conatin at least one uuppercase letter ,one lowercase letter, and number'
})
password: string;

@ApiProperty({
  description: 'User display',
  example: 'Mahin Khan',
  minLength: 1,
  maxLength: 100,
})
@IsString()
@IsNotEmpty({message: 'Name is required'})
@MinLength(1, {message: 'Name must be at lease 1 char long'})
@MaxLength(100, {message: 'Name must not exceed 100 char'})
name:string;
}
