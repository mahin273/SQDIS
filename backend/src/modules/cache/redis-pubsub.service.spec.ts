import { ConfigService } from '@nestjs/config';
import { PUBSUB_CHANNELS, RedisPubSubService } from './redis-pubsub.service';

describe('RedisPubSubService', () => {
  let service: RedisPubSubService;
  let publisher: { publish: jest.Mock; quit: jest.Mock; on: jest.Mock };
  let subscriber: { subscribe: jest.Mock; unsubscribe: jest.Mock; quit: jest.Mock; on: jest.Mock };
  let messageListener: ((channel: string, message: string) => void) | undefined;

  beforeEach(() => {
    publisher = {
      publish: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    subscriber = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn((event, listener) => {
        if (event === 'message') {
          messageListener = listener;
        }
      }),
    };
    service = new RedisPubSubService({} as ConfigService);
  });

  function connectMockRedis() {
    (service as any).publisher = publisher;
    (service as any).subscriber = subscriber;
    (service as any).isPublisherConnected = true;
    (service as any).isSubscriberConnected = true;
  }

  it('reports unavailable and skips publish/subscribe without Redis connections', async () => {
    await expect(service.publish('channel', 'event', { ok: true })).resolves.toBe(false);
    await expect(service.subscribe('channel', jest.fn())).resolves.toBe(false);

    expect(service.isAvailable()).toBe(false);
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(subscriber.subscribe).not.toHaveBeenCalled();
  });

  it('publishes serialized messages with server metadata', async () => {
    connectMockRedis();

    await expect(service.publishCommitEvent({ sha: 'abc' })).resolves.toBe(true);

    expect(publisher.publish).toHaveBeenCalledWith(
      PUBSUB_CHANNELS.COMMIT_EVENTS,
      expect.stringContaining('"type":"commit:new"'),
    );
    const [, rawMessage] = publisher.publish.mock.calls[0];
    expect(JSON.parse(rawMessage)).toMatchObject({
      type: 'commit:new',
      payload: { sha: 'abc' },
      serverId: service.getServerId(),
    });
  });

  it('subscribes handlers, dispatches incoming messages, and unsubscribes empty channels', async () => {
    connectMockRedis();
    const handler = jest.fn();

    await expect(service.subscribe(PUBSUB_CHANNELS.SCORE_EVENTS, handler)).resolves.toBe(true);
    expect(service.getSubscribedChannels()).toEqual([PUBSUB_CHANNELS.SCORE_EVENTS]);
    expect(subscriber.subscribe).toHaveBeenCalledWith(PUBSUB_CHANNELS.SCORE_EVENTS);

    messageListener?.(
      PUBSUB_CHANNELS.SCORE_EVENTS,
      JSON.stringify({ type: 'score:updated', payload: { id: 1 }, timestamp: 'now' }),
    );
    expect(handler).toHaveBeenCalledWith({
      type: 'score:updated',
      payload: { id: 1 },
      timestamp: 'now',
    });

    await expect(service.unsubscribe(PUBSUB_CHANNELS.SCORE_EVENTS, handler)).resolves.toBe(true);
    expect(subscriber.unsubscribe).toHaveBeenCalledWith(PUBSUB_CHANNELS.SCORE_EVENTS);
    expect(service.getSubscribedChannels()).toEqual([]);
  });

  it('returns false when publishing fails', async () => {
    connectMockRedis();
    publisher.publish.mockRejectedValue(new Error('network'));

    await expect(service.publishAlertEvent({ id: 'alert-1' })).resolves.toBe(false);
  });
});
