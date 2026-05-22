import { IsUUID, IsEnum } from 'class-validator';

/**
 * Score type enum for recalculation
 */
export enum ScoreType {
  DQS = 'dqs',
  SQS = 'sqs',
}

/**
 * DTO for score recalculation request
 */
export class RecalculateDto {
  @IsUUID()
  entityId!: string;

  @IsEnum(ScoreType)
  type!: ScoreType;
}
