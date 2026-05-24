import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authenticate, requireAdmin);

const allocSchema = z.object({
  source: z.enum(['CARD_TEAM','LOYALTY_TEAM','MARKETING_TEAM','OTHER']),
  amount: z.number().positive(),
  note: z.string().optional(),
});

router.post('/campaigns/:id/allocate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = allocSchema.parse(req.body);
    const alloc = await prisma.budgetAllocation.create({
      data: { campaignId: req.params.id, allocatedBy: req.user!.userId, ...body },
    });
    await prisma.campaign.update({
      where: { id: req.params.id },
      data: { budgetTotal: { increment: body.amount } },
    });
    res.status(201).json(alloc);
  } catch (e) { next(e); }
});

router.get('/campaigns/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [campaign, allocations] = await Promise.all([
      prisma.campaign.findFirst({ where: { id: req.params.id }, select: { budgetTotal: true, budgetSpent: true } }),
      prisma.budgetAllocation.findMany({ where: { campaignId: req.params.id } }),
    ]);
    res.json({ campaign, allocations });
  } catch (e) { next(e); }
});

export default router;
