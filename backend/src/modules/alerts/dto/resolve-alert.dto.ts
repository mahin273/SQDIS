import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for resolving an alert
 */
export class ResolveAlertDto {
  @IsNotEmpty()
  @IsString()
  resolutionNotes!: string;
}
