/**
 * BullMQ Worker process
 * Handles async reward disbursements
 */
import 'dotenv/config';
import { startRewardWorker } from './modules/budget/reward.queue';
import { logger } from './config/logger';

logger.info('Starting reward worker...');

const worker = startRewardWorker();

worker.on('ready', () => logger.info('✅ Reward worker ready'));

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
