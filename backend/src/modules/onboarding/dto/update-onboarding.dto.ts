import { IsOptional, IsUUID, IsEnum, IsInt, Min } from 'class-validator';
import { OnboardingStatus } from '@prisma/client';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsUUID()
  mentorId?: string;

  @IsOptional()
  @IsEnum(OnboardingStatus)
  status?: OnboardingStatus;
}

export class ExtendOnboardingDto {
  @IsInt()
  @Min(1)
  additionalDays!: number;
}
