/* eslint-disable */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({
        description: 'Email address or username (email alias) associated with the account',
        example: 'user@example.com',
    })
    @IsString()
    @IsNotEmpty({ message: 'Email or username is required' })
    identifier: string;
}
