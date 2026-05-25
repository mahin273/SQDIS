import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for sprint export response
 */
export class SprintExportResponseDto {
  @ApiProperty({ description: 'Export filename with timestamp' })
  filename!: string;

  @ApiProperty({ description: 'Content type of the export' })
  contentType!: string;

  @ApiProperty({ description: 'Export data (base64 encoded for PDF, plain text for CSV)' })
  data!: string;
}

/**
 * DTO for contributor breakdown in export
 */
export class ContributorBreakdownDto {
  @ApiProperty({ description: 'Developer ID' })
  id!: string;

  @ApiProperty({ description: 'Developer name' })
  name!: string;

  @ApiProperty({ description: 'Developer email' })
  email!: string;

  @ApiProperty({ description: 'Total commits in sprint' })
  totalCommits!: number;

  @ApiProperty({ description: 'Lines added' })
  linesAdded!: number;

  @ApiProperty({ description: 'Lines deleted' })
  linesDeleted!: number;

  @ApiProperty({ description: 'Total lines changed' })
  linesChanged!: number;

  @ApiProperty({ description: 'Number of bugfix commits' })
  bugfixCommits!: number;

  @ApiProperty({ description: 'Number of feature commits' })
  featureCommits!: number;

  @ApiProperty({ description: 'Number of reviews given' })
  reviewsGiven!: number;

  @ApiProperty({ description: 'DQS score (null if not available)', nullable: true })
  dqsScore!: number | null;
}
