import Redis from 'ioredis';
import { config } from './env';
import { logger } from './logger';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  lazyConnect: false,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', err));

// Helper: distributed lock with TTL
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  const token = Math.random().toString(36).slice(2);
  const result = await redis.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
  return result === 'OK' ? token : null;
}

export async function releaseLock(key: string, token: string): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, `lock:${key}`, token);
}
