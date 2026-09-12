import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releasesService } from './releases.service';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('releasesService - Telemetry & Readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers on-demand canary telemetry evaluation for a release', async () => {
    const mockTelemetry = {
      id: 'tel-1',
      releaseId: 'rel-1',
      serviceName: 'sqdis-backend',
      verdict: 'HEALTHY',
      recommendation: 'PROCEED',
      score: 98,
      baselineMetrics: {
        p95_latency_ms: 12.5,
        error_rate_5xx: 0.0,
        memory_rss_mb: 178.0,
      },
      canaryMetrics: {
        p95_latency_ms: 13.0,
        error_rate_5xx: 0.0,
        memory_rss_mb: 180.2,
      },
      deltas: {
        latency_delta_pct: 4.0,
        error_rate_delta: 0.0,
        memory_delta_pct: 1.23,
      },
      violations: [],
      createdAt: new Date().toISOString(),
    };

    vi.mocked(api.post).mockResolvedValueOnce({ data: mockTelemetry });

    const result = await releasesService.evaluateCanaryTelemetry('rel-1', {
      serviceName: 'sqdis-backend',
      canaryDurationMinutes: 10,
    });

    expect(api.post).toHaveBeenCalledWith('/releases/rel-1/telemetry/evaluate', {
      serviceName: 'sqdis-backend',
      canaryDurationMinutes: 10,
    });
    expect(result.verdict).toBe('HEALTHY');
    expect(result.score).toBe(98);
    expect(result.deltas.latency_delta_pct).toBe(4.0);
  });

  it('fetches historical canary telemetry evaluations for a release', async () => {
    const mockList = [
      {
        id: 'tel-1',
        releaseId: 'rel-1',
        verdict: 'HEALTHY',
        recommendation: 'PROCEED',
        score: 100,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(api.get).mockResolvedValueOnce({ data: mockList });

    const result = await releasesService.getCanaryTelemetry('rel-1');

    expect(api.get).toHaveBeenCalledWith('/releases/rel-1/telemetry');
    expect(result).toHaveLength(1);
    expect(result[0].verdict).toBe('HEALTHY');
  });

  it('fetches release readiness including telemetry score breakdown', async () => {
    const mockReadiness = {
      score: 88,
      bugScore: 90,
      coverageScore: 85,
      dqsScore: 82,
      testPassRate: 80,
      telemetryScore: 95,
      telemetryVerdict: 'HEALTHY' as const,
      telemetryRecommendation: 'PROCEED' as const,
      hasTelemetry: true,
      isAtRisk: false,
    };

    vi.mocked(api.get).mockResolvedValueOnce({ data: mockReadiness });

    const result = await releasesService.getReadiness('rel-1');

    expect(api.get).toHaveBeenCalledWith('/releases/rel-1/readiness');
    expect(result.score).toBe(88);
    expect(result.hasTelemetry).toBe(true);
    expect(result.telemetryScore).toBe(95);
  });
});
