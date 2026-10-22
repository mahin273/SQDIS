jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ScoreProcessor } from './score.processor';
import { ScoresService } from '../scores.service';
import { ScoreJobType, ScoreJobData } from '../types';

describe('ScoreProcessor', () => {
  let processor: ScoreProcessor;
  let scoresService: {
    calculateDQS: jest.Mock;
    calculateSQS: jest.Mock;
    verifyEntityOwnership: jest.Mock;
  };

  beforeEach(async () => {
    scoresService = {
      calculateDQS: jest.fn(),
      calculateSQS: jest.fn(),
      verifyEntityOwnership: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoreProcessor,
        { provide: ScoresService, useValue: scoresService },
      ],
    }).compile();

    processor = module.get<ScoreProcessor>(ScoreProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('processes DQS score calculation job successfully', async () => {
    const job = {
      id: 'job-1',
      data: {
        entityId: 'dev-1',
        type: ScoreJobType.DQS,
        organizationId: 'org-1',
        triggeredBy: 'commit',
      },
    } as Job<ScoreJobData>;

    scoresService.calculateDQS.mockResolvedValue({
      score: 85.5,
      modelVersion: '1.0.0',
      calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await processor.process(job);

    expect(scoresService.calculateDQS).toHaveBeenCalledWith('dev-1', 'org-1');
    expect(result).toEqual(
      expect.objectContaining({
        entityId: 'dev-1',
        type: ScoreJobType.DQS,
        score: 85.5,
        modelVersion: '1.0.0',
        success: true,
      }),
    );
  });

  it('processes SQS score calculation job successfully', async () => {
    const job = {
      id: 'job-2',
      data: {
        entityId: 'project-1',
        type: ScoreJobType.SQS,
        organizationId: 'org-1',
      },
    } as Job<ScoreJobData>;

    scoresService.calculateSQS.mockResolvedValue({
      score: 92.0,
      modelVersion: '1.0.0',
      calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await processor.process(job);

    expect(scoresService.calculateSQS).toHaveBeenCalledWith('project-1', 'org-1');
    expect(result).toEqual(
      expect.objectContaining({
        entityId: 'project-1',
        type: ScoreJobType.SQS,
        score: 92.0,
        success: true,
      }),
    );
  });

  it('fails job if entity does not belong to organization', async () => {
    scoresService.verifyEntityOwnership.mockRejectedValue(
      new Error('Developer dev-999 not found in organization org-1'),
    );

    const job = {
      id: 'job-unauth',
      data: {
        entityId: 'dev-999',
        type: ScoreJobType.DQS,
        organizationId: 'org-1',
      },
    } as Job<ScoreJobData>;

    const result = await processor.process(job);

    expect(scoresService.verifyEntityOwnership).toHaveBeenCalledWith('dev-999', ScoreJobType.DQS, 'org-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found in organization');
  });

  it('handles calculation failures gracefully without throwing unhandled exceptions', async () => {
    const job = {
      id: 'job-3',
      data: {
        entityId: 'dev-2',
        type: ScoreJobType.DQS,
        organizationId: 'org-1',
      },
    } as Job<ScoreJobData>;

    scoresService.calculateDQS.mockRejectedValue(new Error('ML Service Offline'));

    const result = await processor.process(job);

    expect(result).toEqual(
      expect.objectContaining({
        entityId: 'dev-2',
        type: ScoreJobType.DQS,
        score: null,
        success: false,
        message: 'ML Service Offline',
      }),
    );
  });
});
