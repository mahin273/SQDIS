import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emailAliasesService } from './email-aliases.service';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('emailAliasesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches unmapped commit emails for admin', async () => {
    const mockUnmapped = [
      { id: '1', email: 'dev@external.com', commitCount: 15, firstSeenAt: '2026-08-01', lastSeenAt: '2026-08-10' },
    ];
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockUnmapped });

    const result = await emailAliasesService.getUnmappedEmails();
    expect(api.get).toHaveBeenCalledWith('/admin/unmapped-emails');
    expect(result).toEqual(mockUnmapped);
  });

  it('assigns unmapped email to user', async () => {
    const mockAlias = { id: 'alias-1', email: 'dev@external.com', userId: 'user-1', isVerified: true, createdAt: '' };
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockAlias });

    const result = await emailAliasesService.assignEmail({
      email: 'dev@external.com',
      userId: 'user-1',
    });

    expect(api.post).toHaveBeenCalledWith('/admin/email-aliases/assign', {
      email: 'dev@external.com',
      userId: 'user-1',
    });
    expect(result).toEqual(mockAlias);
  });

  it('removes email alias mapping', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: {} });

    await emailAliasesService.removeEmailMapping('alias-1');
    expect(api.delete).toHaveBeenCalledWith('/admin/email-aliases/alias-1');
  });

  it('verifies email alias with token', async () => {
    const mockRes = { success: true, message: 'Verified' };
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockRes });

    const result = await emailAliasesService.verify('token-123');
    expect(api.get).toHaveBeenCalledWith('/email-aliases/verify/token-123');
    expect(result).toEqual(mockRes);
  });
});
