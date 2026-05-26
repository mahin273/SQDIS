import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * DTO for updating a key result
 *
 * Allows partial updates to key result properties.
 * When currentValue is updated, the parent goal's OKR progress
 * is automatically recalculated.
 */
export class UpdateKeyResultDto {
  /**
   * Updated description of the key result
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Updated target value for this key result
   */
  @IsNumber()
  @Min(0)
  @IsOptional()
  targetValue?: number;

  /**
   * Current progress value for this key result
   * Updating this triggers OKR progress recalculation
   */
  @IsNumber()
  @Min(0)
  @IsOptional()
  currentValue?: number;

  /**
   * Updated weight for this key result in OKR calculation
   */
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  weight?: number;
}
