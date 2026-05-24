import rateLimit from 'express-rate-limit';
import { Request } from 'express';

interface RateLimitOptions {
  max: number;
  windowMs: number;
  keyPrefix?: string;
}

export function rateLimiter({ max, windowMs, keyPrefix = '' }: RateLimitOptions) {
  return rateLimit({
    max,
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Rate limit per customer + campaign for game endpoints
      const user = req.user?.userId ?? req.ip;
      const campaign = req.params.campaignId ?? '';
      return `${keyPrefix}${user}:${campaign}`;
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: 'Too many requests. Please slow down.',
        code: 'RATE_LIMITED',
      });
    },
  });
}
