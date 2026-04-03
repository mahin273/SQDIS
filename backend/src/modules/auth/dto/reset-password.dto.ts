/* eslint-disable */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'Password reset token received via email',
        example: 'abc123def456...',
    })
    @IsString()
    @IsNotEmpty({ message: 'Reset token is required' })
    token: string;

    @ApiProperty({
        description: 'New password (min 8 characters, must contain uppercase, lowercase, and number)',
        example: 'NewSecurePass123',
        minLength: 8,
        maxLength: 128,
    })
    @IsString()
    @IsNotEmpty({ message: 'New password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(128, { message: 'Password must not exceed 128 characters' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    })
    newPassword: string;
}
