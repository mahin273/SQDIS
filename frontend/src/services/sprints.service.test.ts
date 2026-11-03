import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sprintsService } from './sprints.service';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('sprintsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches all sprints for team', async () => {
    const mockSprints = [{ id: 's-1', name: 'Sprint 1' }];
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSprints });

    const result = await sprintsService.getAll('team-1');
    expect(api.get).toHaveBeenCalledWith('/sprints', { params: { teamId: 'team-1' } });
    expect(result).toEqual(mockSprints);
  });

  it('fetches active sprints', async () => {
    const mockActive = [{ id: 's-active', name: 'Sprint Active' }];
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockActive });

    const result = await sprintsService.getActive('team-1');
    expect(api.get).toHaveBeenCalledWith('/sprints/active', { params: { teamId: 'team-1' } });
    expect(result).toEqual(mockActive);
  });

  it('fetches sprint by id', async () => {
    const mockSprint = { id: 's-1', name: 'Sprint 1' };
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSprint });

    const result = await sprintsService.getById('s-1');
    expect(api.get).toHaveBeenCalledWith('/sprints/s-1');
    expect(result).toEqual(mockSprint);
  });

  it('fetches burndown data via GET /sprints/:id/burndown', async () => {
    const mockBurndown = {
      sprintId: 's-1',
      totalWork: 50,
      completedWork: 25,
      remainingWork: 25,
      burndownData: [
        { date: '2026-08-01', idealRemaining: 50, actualRemaining: 50, completed: 0 },
        { date: '2026-08-02', idealRemaining: 45, actualRemaining: 40, completed: 10 },
      ],
      isOnTrack: true,
    };
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockBurndown });

    const result = await sprintsService.getBurndown('s-1');
    expect(api.get).toHaveBeenCalledWith('/sprints/s-1/burndown');
    expect(result).toEqual(mockBurndown);
  });

  it('updates sprint via PATCH /sprints/:id', async () => {
    const updatedSprint = { id: 's-1', name: 'Sprint 1 Updated', status: 'COMPLETED' };
    vi.mocked(api.patch).mockResolvedValueOnce({ data: updatedSprint });

    const result = await sprintsService.update('s-1', { status: 'COMPLETED' as any });
    expect(api.patch).toHaveBeenCalledWith('/sprints/s-1', { status: 'COMPLETED' });
    expect(result).toEqual(updatedSprint);
  });

  it('exports report PDF blob', async () => {
    const mockBlob = new Blob(['pdf-data'], { type: 'application/pdf' });
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockBlob });

    const result = await sprintsService.exportPdf('s-1');
    expect(api.get).toHaveBeenCalledWith('/sprints/s-1/export/pdf', { responseType: 'blob' });
    expect(result).toEqual(mockBlob);
  });
});
