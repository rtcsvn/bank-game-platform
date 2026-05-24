import { CampaignStatus, GameType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/error-handler';
import { auditService } from '../audit/audit.service';
import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  gameType: z.nativeEnum(GameType),
  budgetTotal: z.number().positive(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  maxTurnsPerDay: z.number().int().positive().optional(),
  maxTurnsTotal: z.number().int().positive().optional(),
  gameConfig: z.record(z.unknown()).optional(),
  prizePools: z.array(z.object({
    tier: z.enum(['MEGA', 'MONTHLY', 'DAILY']),
    prizeType: z.enum(['CASH','VOUCHER','LOYALTY_POINTS','PHYSICAL','PRETTY_NUMBER','MFEST_TICKET']),
    name: z.string(),
    valueVnd: z.number().positive(),
    totalQty: z.number().int().positive(),
    weight: z.number().int().min(1).default(100),
  })).optional(),
  earnRules: z.array(z.object({
    productType: z.string(),
    minAmount: z.number().optional(),
    turnsPerUnit: z.number().int().positive().default(1),
    unitAmount: z.number().optional(),
    maxTurnsPerMonth: z.number().int().optional(),
  })).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export class CampaignService {
  async create(input: CreateCampaignInput, createdBy: string, tenantId: string) {
    if (input.startAt >= input.endAt) {
      throw new AppError(400, 'startAt must be before endAt', 'INVALID_DATES');
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const c = await tx.campaign.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description,
          gameType: input.gameType,
          budgetTotal: input.budgetTotal,
          startAt: input.startAt,
          endAt: input.endAt,
          maxTurnsPerDay: input.maxTurnsPerDay,
          maxTurnsTotal: input.maxTurnsTotal,
          createdBy,
          status: 'DRAFT',
        },
      });

      if (input.gameConfig) {
        await tx.gameConfig.create({
          data: { campaignId: c.id, config: input.gameConfig },
        });
      }

      if (input.prizePools?.length) {
        await tx.prizePool.createMany({
          data: input.prizePools.map((p) => ({
            campaignId: c.id,
            tier: p.tier,
            prizeType: p.prizeType,
            name: p.name,
            valueVnd: p.valueVnd,
            totalQty: p.totalQty,
            remainingQty: p.totalQty,
            weight: p.weight,
          })),
        });
      }

      if (input.earnRules?.length) {
        await tx.earnRule.createMany({
          data: input.earnRules.map((r) => ({
            campaignId: c.id,
            productType: r.productType as never,
            minAmount: r.minAmount,
            turnsPerUnit: r.turnsPerUnit,
            unitAmount: r.unitAmount,
            maxTurnsPerMonth: r.maxTurnsPerMonth,
          })),
        });
      }

      return c;
    });

    await auditService.log({
      tenantId,
      actorId: createdBy,
      action: 'campaign.created',
      entity: 'campaigns',
      entityId: campaign.id,
      after: { name: campaign.name, status: campaign.status },
    });

    return campaign;
  }

  async list(tenantId: string, filters?: { status?: CampaignStatus; gameType?: GameType }) {
    return prisma.campaign.findMany({
      where: { tenantId, ...filters },
      include: {
        prizePools: { select: { tier: true, prizeType: true, totalQty: true, remainingQty: true } },
        creator: { select: { email: true } },
        approver: { select: { email: true } },
        _count: { select: { customerPlays: true, customerTurns: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(campaignId: string, tenantId: string) {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        gameConfig: true,
        prizePools: true,
        earnRules: true,
        eligibilityConfig: true,
        _count: { select: { customerPlays: true, customerTurns: true } },
      },
    });
    if (!c) throw new AppError(404, 'Campaign not found', 'NOT_FOUND');
    return c;
  }

  async submitForApproval(campaignId: string, actorId: string, tenantId: string) {
    return this.transition(campaignId, tenantId, 'DRAFT', 'PENDING_APPROVAL', actorId, 'campaign.submitted');
  }

  async approve(campaignId: string, approverId: string, tenantId: string) {
    const c = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!c) throw new AppError(404, 'Campaign not found', 'NOT_FOUND');
    if (c.status !== 'PENDING_APPROVAL') throw new AppError(400, 'Campaign is not pending approval', 'INVALID_STATE');

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'APPROVED', approvedBy: approverId, approvedAt: new Date() },
    });

    await auditService.log({ tenantId, actorId: approverId, action: 'campaign.approved', entity: 'campaigns', entityId: campaignId });
    return updated;
  }

  async reject(campaignId: string, approverId: string, tenantId: string, note: string) {
    const c = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!c) throw new AppError(404, 'Campaign not found', 'NOT_FOUND');
    if (c.status !== 'PENDING_APPROVAL') throw new AppError(400, 'Campaign is not pending approval', 'INVALID_STATE');

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'DRAFT', rejectionNote: note },
    });

    await auditService.log({ tenantId, actorId: approverId, action: 'campaign.rejected', entity: 'campaigns', entityId: campaignId, after: { note } });
    return updated;
  }

  async activate(campaignId: string, actorId: string, tenantId: string) {
    return this.transition(campaignId, tenantId, 'APPROVED', 'ACTIVE', actorId, 'campaign.activated');
  }

  async pause(campaignId: string, actorId: string, tenantId: string) {
    return this.transition(campaignId, tenantId, 'ACTIVE', 'PAUSED', actorId, 'campaign.paused');
  }

  private async transition(
    campaignId: string,
    tenantId: string,
    fromStatus: CampaignStatus,
    toStatus: CampaignStatus,
    actorId: string,
    auditAction: string,
  ) {
    const c = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!c) throw new AppError(404, 'Campaign not found', 'NOT_FOUND');
    if (c.status !== fromStatus) throw new AppError(400, `Expected status ${fromStatus}, got ${c.status}`, 'INVALID_STATE');

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: toStatus },
    });

    await auditService.log({ tenantId, actorId, action: auditAction, entity: 'campaigns', entityId: campaignId, before: { status: fromStatus }, after: { status: toStatus } });
    return updated;
  }
}

export const campaignService = new CampaignService();
