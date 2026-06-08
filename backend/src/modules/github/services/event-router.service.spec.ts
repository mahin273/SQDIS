import { EventHandler } from '../interfaces/event-handler.interface';
import { EventRouter } from './event-router.service';

describe('EventRouter', () => {
  let router: EventRouter;

  beforeEach(() => {
    router = new EventRouter();
  });

  it('routes registered events to their handler', async () => {
    const handler: EventHandler = {
      getEventType: jest.fn(() => 'push'),
      validatePayload: jest.fn(() => true),
      parsePayload: jest.fn((payload) => payload),
      handle: jest.fn().mockResolvedValue({
        success: true,
        jobsQueued: 2,
        message: 'queued',
      }),
    };
    const payload = { ref: 'refs/heads/main' };

    router.registerHandler('push', handler);

    await expect(router.routeEvent('push', payload, 'repo-1', 'org-1')).resolves.toEqual({
      success: true,
      jobsQueued: 2,
      message: 'queued',
    });
    expect(handler.handle).toHaveBeenCalledWith(payload, 'repo-1', 'org-1');
    expect(router.getSupportedEvents()).toEqual(['push']);
  });

  it('acknowledges unsupported events without queueing jobs', async () => {
    await expect(router.routeEvent('issues', {}, 'repo-1', 'org-1')).resolves.toEqual({
      success: true,
      jobsQueued: 0,
      message: 'Unsupported event type: issues',
    });
  });
});
