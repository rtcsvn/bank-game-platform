import { Queue, Worker, Job } from 'bullmq';
import { PrizeType } from '@prisma/client';
import { redis } from '../../config/redis';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';

interface RewardJob {
  playId: string;
  customerId: string;
  prizePoolId: string;
  prizeType: PrizeType;
  valueVnd: number;
}

export const rewardQueue = new Queue<RewardJob>('rewards', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Worker that processes disbursements
export function startRewardWorker() {
  const worker = new Worker<RewardJob>(
    'rewards',
    async (job: Job<RewardJob>) => {
      const { playId, customerId, prizeType, valueVnd } = job.data;

      // Create disbursement record
      const disburse = await prisma.rewardDisbursement.upsert({
        where: { playId },
        create: { playId, customerId, prizeType, valueVnd, status: 'PROCESSING', attempts: 1 },
        update: { status: 'PROCESSING', attempts: { increment: 1 } },
      });

      try {
        switch (prizeType) {
          case 'CASH':
            await disburseCash(customerId, valueVnd, playId);
            break;
          case 'VOUCHER':
            await disburseVoucher(customerId, disburse.id);
            break;
          case 'LOYALTY_POINTS':
            await disburseLoyaltyPoints(customerId, valueVnd);
            break;
          case 'PRETTY_NUMBER':
          case 'PHYSICAL':
          case 'MFEST_TICKET':
            // Physical prizes: just mark pending manual handoff
            await prisma.rewardDisbursement.update({
              where: { id: disburse.id },
              data: { status: 'PENDING', disbursedAt: null },
            });
            return; // Don't mark as COMPLETED yet
        }

        await prisma.rewardDisbursement.update({
          where: { id: disburse.id },
          data: { status: 'COMPLETED', disbursedAt: new Date() },
        });

        logger.info('Reward disbursed', { playId, prizeType, valueVnd, customerId });
      } catch (err) {
        await prisma.rewardDisbursement.update({
          where: { id: disburse.id },
          data: { status: 'FAILED', failReason: String(err) },
        });
        throw err; // Re-throw so BullMQ retries
      }
    },
    { connection: redis, concurrency: 10 }
  );

  worker.on('failed', (job, err) => {
    logger.error('Reward job failed', { jobId: job?.id, err });
  });

  return worker;
}

// ── Disbursement handlers (stubs — wire to actual bank APIs) ──

async function disburseCash(customerId: string, amount: number, txRef: string): Promise<void> {
  logger.info(`[STUB] Disbursing ${amount} VND to customer ${customerId}, ref: ${txRef}`);
  // TODO: Call bank core transfer API
  // await bankApi.transfer({ toAccount: customer.accountNo, amount, ref: txRef });
}

async function disburseVoucher(customerId: string, disbursementId: string): Promise<void> {
  // Generate voucher code
  const code = `VOCH-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  await prisma.rewardDisbursement.update({
    where: { id: disbursementId },
    data: { voucherCode: code },
  });
  logger.info(`[STUB] Voucher ${code} issued to customer ${customerId}`);
  // TODO: Send voucher via notification service
}

async function disburseLoyaltyPoints(customerId: string, amount: number): Promise<void> {
  logger.info(`[STUB] Adding ${amount} loyalty points to customer ${customerId}`);
  // TODO: Call loyalty system API
}
