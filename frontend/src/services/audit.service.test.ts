import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditService } from './audit.service';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('auditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists audit exports via GET /audit-logs/export', async () => {
    const mockExports = [
      {
        id: 'exp-1',
        organizationId: 'org-1',
        format: 'CSV',
        status: 'COMPLETED',
        recordCount: 150,
        createdAt: '2026-09-01T00:00:00Z',
      },
    ];
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockExports });

    const result = await auditService.listExports();
    expect(api.get).toHaveBeenCalledWith('/audit-logs/export');
    expect(result).toEqual(mockExports);
  });

  it('downloads audit export file via GET /audit-logs/export/:id/download as blob', async () => {
    const mockBlob = new Blob(['sample-csv'], { type: 'text/csv' });
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockBlob });

    const result = await auditService.downloadExport('exp-1');
    expect(api.get).toHaveBeenCalledWith('/audit-logs/export/exp-1/download', {
      responseType: 'blob',
    });
    expect(result).toEqual(mockBlob);
  });

  it('initiates export via POST /audit-logs/export', async () => {
    const mockRes = { id: 'exp-2', format: 'JSON', status: 'PENDING' };
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockRes });

    const result = await auditService.exportLogs({ format: 'JSON' });
    expect(api.post).toHaveBeenCalledWith('/audit-logs/export', { format: 'JSON' });
    expect(result).toEqual(mockRes);
  });
});
