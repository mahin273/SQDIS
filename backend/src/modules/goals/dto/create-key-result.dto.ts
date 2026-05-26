import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * DTO for creating a key result
 * Key results are measurable outcomes that contribute to an objective (goal).
 * Multiple key results can be added to a single goal to form an OKR.
 * The weight determines how much each key result contributes to the overall
 * OKR progress calculation (weighted average).
 */
export class CreateKeyResultDto {
  /**
   * Description of the key result
   * Should be specific and measurable
   */
  @IsString()
  @IsNotEmpty()
  description!: string;

  /**
   * Target value to achieve for this key result
   */
  @IsNumber()
  @Min(0)
  targetValue!: number;

  /**
   * Weight of this key result in the OKR progress calculation
   * Higher weight means more contribution to overall progress
   * Default is 1.0 for equal weighting
   */
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  weight?: number = 1;
}
