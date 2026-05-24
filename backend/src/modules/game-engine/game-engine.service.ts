import crypto from 'crypto';
import { PrizePool, PrizeType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { redis, acquireLock, releaseLock } from '../../config/redis';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../config/logger';
import { auditService } from '../audit/audit.service';
import { rewardQueue } from '../budget/reward.queue';

// ── Types ──────────────────────────────────────────────────

export interface PlayResult {
  isWinner: boolean;
  prize: PrizePool | null;
  play: { id: string; rngSeed: string; drawCode?: string };
}

// ── RNG ───────────────────────────────────────────────────

function secureRandom(): { seed: string; value: number } {
  const buf = crypto.randomBytes(8);
  const seed = buf.toString('hex');
  // Normalize to [0, 1)
  const value = buf.readUInt32BE(0) / 0xffffffff;
  return { seed, value };
}

// ── Prize pool helpers ────────────────────────────────────

async function getActivePrizePool(campaignId: string) {
  return prisma.prizePool.findMany({
    where: { campaignId, isActive: true, remainingQty: { gt: 0 } },
    orderBy: { tier: 'asc' },
  });
}

// Weighted random selection
function weightedDraw(prizes: PrizePool[], rng: number): PrizePool | null {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight * p.remainingQty, 0);
  if (totalWeight === 0) return null;

  let cursor = rng * totalWeight;
  for (const prize of prizes) {
    cursor -= prize.weight * prize.remainingQty;
    if (cursor <= 0) return prize;
  }
  return prizes[prizes.length - 1] ?? null;
}

// ── Game Engine Service ───────────────────────────────────

export class GameEngineService {
  // ── Consume a turn and execute LUCKY_BOX draw ──────────
  async playLuckyBox(params: {
    campaignId: string;
    customerId: string;
    tenantId: string;
    idempotencyKey?: string;
  }): Promise<PlayResult> {
    const { campaignId, customerId, tenantId, idempotencyKey } = params;

    // Idempotency: check if already played
    if (idempotencyKey) {
      const existing = await redis.get(`idem:play:${idempotencyKey}`);
      if (existing) return JSON.parse(existing);
    }

    // Distributed lock: one play at a time per customer+campaign
    const lockKey = `play:${campaignId}:${customerId}`;
    const lockToken = await acquireLock(lockKey, 10_000);
    if (!lockToken) throw new AppError(429, 'Play in progress, please retry', 'LOCK_FAILED');

    try {
      // Validate campaign is active
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, tenantId, status: 'ACTIVE' },
      });
      if (!campaign) throw new AppError(404, 'Campaign not found or inactive', 'NOT_FOUND');

      // Validate campaign dates
      const now = new Date();
      if (now < campaign.startAt || now > campaign.endAt) {
        throw new AppError(400, 'Campaign is not currently running', 'CAMPAIGN_NOT_RUNNING');
      }

      // Consume an available turn (atomic)
      const turn = await prisma.customerTurn.findFirst({
        where: { campaignId, customerId, status: 'AVAILABLE', OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ]},
        orderBy: { createdAt: 'asc' },
      });
      if (!turn) throw new AppError(400, 'No turns available', 'NO_TURNS');

      await prisma.customerTurn.update({
        where: { id: turn.id },
        data: { status: 'USED', usedAt: now },
      });

      // Draw prize
      const { seed, value } = secureRandom();
      const activePrizes = await getActivePrizePool(campaignId);
      const selectedPrize = weightedDraw(activePrizes.filter(p => p.tier === 'DAILY'), value);

      let isWinner = false;
      let prizePoolId: string | null = null;

      if (selectedPrize) {
        // Atomic decrement — prevents oversell
        const updated = await prisma.prizePool.updateMany({
          where: { id: selectedPrize.id, remainingQty: { gt: 0 } },
          data: { remainingQty: { decrement: 1 } },
        });
        if (updated.count > 0) {
          isWinner = true;
          prizePoolId = selectedPrize.id;
        }
      }

      // Record play
      const play = await prisma.customerPlay.create({
        data: { campaignId, customerId, turnId: turn.id, prizePoolId, rngSeed: seed, isWinner },
      });

      // Enqueue reward disbursement if winner
      if (isWinner && selectedPrize) {
        await rewardQueue.add('disburse', {
          playId: play.id,
          customerId,
          prizePoolId: selectedPrize.id,
          prizeType: selectedPrize.prizeType,
          valueVnd: Number(selectedPrize.valueVnd),
        });
      }

      await auditService.log({
        tenantId,
        actorId: customerId,
        action: 'game.play',
        entity: 'customer_plays',
        entityId: play.id,
        after: { isWinner, prizePoolId, rngSeed: seed },
      });

      const result: PlayResult = {
        isWinner,
        prize: isWinner ? selectedPrize : null,
        play: { id: play.id, rngSeed: seed },
      };

      // Cache for idempotency (5 min)
      if (idempotencyKey) {
        await redis.set(`idem:play:${idempotencyKey}`, JSON.stringify(result), 'EX', 300);
      }

      return result;
    } finally {
      await releaseLock(lockKey, lockToken!);
    }
  }

  // ── Earn turns from a bank transaction ────────────────────
  async earnTurns(params: {
    campaignId: string;
    customerId: string;
    tenantId: string;
    productType: string;
    transactionAmount: number;
    sourceTxId: string;
  }): Promise<{ turnsEarned: number }> {
    const { campaignId, customerId, tenantId, productType, transactionAmount, sourceTxId } = params;

    // Idempotency: one turn award per transaction
    const exists = await prisma.customerTurn.findFirst({
      where: { campaignId, customerId, sourceTxId },
    });
    if (exists) return { turnsEarned: 0 };

    // Find matching earn rule
    const rule = await prisma.earnRule.findFirst({
      where: {
        campaignId,
        productType: productType as never,
        isActive: true,
        OR: [{ minAmount: null }, { minAmount: { lte: transactionAmount } }],
      },
    });
    if (!rule) return { turnsEarned: 0 };

    // Calculate turns
    let turns = rule.turnsPerUnit;
    if (rule.unitAmount && Number(rule.unitAmount) > 0) {
      turns = Math.floor(transactionAmount / Number(rule.unitAmount)) * rule.turnsPerUnit;
    }

    // Check monthly cap
    if (rule.maxTurnsPerMonth) {
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const monthlyUsed = await prisma.customerTurn.count({
        where: { campaignId, customerId, createdAt: { gte: monthStart } },
      });
      turns = Math.min(turns, rule.maxTurnsPerMonth - monthlyUsed);
      if (turns <= 0) return { turnsEarned: 0 };
    }

    // Create turn records
    await prisma.customerTurn.createMany({
      data: Array.from({ length: turns }, () => ({
        campaignId,
        customerId,
        sourceTxId,
        productType: productType as never,
        status: 'AVAILABLE' as const,
      })),
    });

    logger.info(`Earned ${turns} turns`, { campaignId, customerId, sourceTxId });
    return { turnsEarned: turns };
  }

  // ── Game Ops: inject prize into active pool ───────────────
  async injectPrize(params: {
    campaignId: string;
    prizePoolId: string;
    qty: number;
    injectedBy: string;
    tenantId: string;
  }): Promise<void> {
    const { campaignId, prizePoolId, qty, injectedBy, tenantId } = params;

    const pool = await prisma.prizePool.findFirst({
      where: { id: prizePoolId, campaignId },
    });
    if (!pool) throw new AppError(404, 'Prize pool not found', 'NOT_FOUND');

    await prisma.prizePool.update({
      where: { id: prizePoolId },
      data: {
        remainingQty: { increment: qty },
        isActive: true,
        injectedAt: new Date(),
        injectedBy,
      },
    });

    await auditService.log({
      tenantId,
      actorId: injectedBy,
      action: 'prize.injected',
      entity: 'prize_pools',
      entityId: prizePoolId,
      after: { qty, prizePoolId },
    });
  }

  // ── Get customer's turn balance ───────────────────────────
  async getTurnBalance(campaignId: string, customerId: string): Promise<number> {
    const cacheKey = `turns:${campaignId}:${customerId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return parseInt(cached);

    const count = await prisma.customerTurn.count({
      where: {
        campaignId,
        customerId,
        status: 'AVAILABLE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    await redis.set(cacheKey, count.toString(), 'EX', 30); // 30s cache
    return count;
  }
}

export const gameEngine = new GameEngineService();
