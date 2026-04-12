/* eslint-disable */
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';


/**
 * DTO for updating a member's role in an organization
 */


export class UpdateMemberRoleDto {
  /**
   * The new role to assign to the member
   * Must be one of: OWNER, ADMIN, TEAM_LEAD, DEVELOPER
   */
  @ApiProperty({
    description: 'New role for the member',
    enum: Role,
    example: Role.ADMIN,
  })
  @IsEnum(Role, { message: 'Role must be one of: OWNER, ADMIN, TEAM_LEAD, DEVELOPER' })
  @IsNotEmpty({ message: 'Role is required' })
  role: Role;
}
