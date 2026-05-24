import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'warn', emit: 'log' },
      { level: 'error', emit: 'log' },
    ],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Log slow queries in dev
prisma.$on('query' as never, (e: { duration: number; query: string }) => {
  if (e.duration > 500) {
    logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});
