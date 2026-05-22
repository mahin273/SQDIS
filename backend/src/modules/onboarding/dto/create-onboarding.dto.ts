import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreateOnboardingDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  mentorId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}
