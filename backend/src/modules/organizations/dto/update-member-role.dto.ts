import { IsEnum, IsNotEmpty } from 'class-validator';

// Enum representing all possible roles in an organization
export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  TEAM_LEAD = 'TEAM_LEAD',
  DEVELOPER = 'DEVELOPER',
}

export class UpdateMemberRoleDto {
  /**
   * The new role to assign to the member
   * Must be one of: OWNER, ADMIN, TEAM_LEAD, DEVELOPER
   */
  @IsEnum(Role, { message: 'Role must be one of: OWNER, ADMIN, TEAM_LEAD, DEVELOPER' })
  @IsNotEmpty({ message: 'Role is required' })
  role: Role;
}