import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReleaseResponseDto } from './release-response.dto';

/**
 * Options for shipping a release with automated GitHub integrations
 */
export class ShipReleaseDto {
  @ApiPropertyOptional({
    description: 'Target repository ID to publish GitHub release or trigger workflow',
    example: '459fe691-b28c-46f9-9a70-1f26b487539f',
  })
  @IsString()
  @IsOptional()
  repositoryId?: string;

  @ApiPropertyOptional({
    description: 'Option A: Auto-create a tagged GitHub Release and publish to repository',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  createGitHubRelease?: boolean;

  @ApiPropertyOptional({
    description: 'Git tag name for the release (defaults to v<version>)',
    example: 'v1.0.1',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  tagName?: string;

  @ApiPropertyOptional({
    description: 'Title of the GitHub Release',
    example: 'Release v1.0.1 - Stability & Telemetry',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  releaseName?: string;

  @ApiPropertyOptional({
    description: 'Release changelog notes or body',
    example: 'Includes automated telemetry watchdog and performance fixes.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  releaseNotes?: string;

  @ApiPropertyOptional({
    description: 'Option B: Trigger a GitHub Actions CI/CD deployment workflow',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  triggerWorkflow?: boolean;

  @ApiPropertyOptional({
    description: 'GitHub Actions workflow file name to dispatch (default: ci.yml)',
    example: 'ci.yml',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  workflowFileName?: string;

  @ApiPropertyOptional({
    description: 'Git branch or ref to trigger workflow on (default: main)',
    example: 'main',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  gitRef?: string;
}

export class GitHubReleaseDetails {
  success!: boolean;
  id?: number;
  tagName?: string;
  name?: string;
  htmlUrl?: string;
  error?: string;
}

export class WorkflowDispatchDetails {
  success!: boolean;
  workflow?: string;
  ref?: string;
  actionsUrl?: string;
  message?: string;
  error?: string;
}

export class ShipReleaseResponseDto {
  release!: ReleaseResponseDto;
  githubRelease?: GitHubReleaseDetails;
  workflowDispatch?: WorkflowDispatchDetails;
}
