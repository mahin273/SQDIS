import { describe, it, expect, vi } from 'vitest';
import { commitsService } from './commits.service';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('commitsService', () => {
  it('fetches commits with parameters', async () => {
    const mockData: any[] = [];
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

    const result = await commitsService.getAll({ page: 1 });
    expect(api.get).toHaveBeenCalledWith('/commits', { params: { page: 1, limit: 20 } });
    expect(result).toEqual(mockData);
  });
});
