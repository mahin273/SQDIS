import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreateOnboardingDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  developerId?: string;

  @IsOptional()
  @IsUUID()
  mentorId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}
