import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authenticate);

// Campaign KPIs
router.get('/campaigns/:id/kpis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const [totalTurns, usedTurns, totalPlays, winners, prizes] = await Promise.all([
      prisma.customerTurn.count({ where: { campaignId: id } }),
      prisma.customerTurn.count({ where: { campaignId: id, status: 'USED' } }),
      prisma.customerPlay.count({ where: { campaignId: id } }),
      prisma.customerPlay.count({ where: { campaignId: id, isWinner: true } }),
      prisma.prizePool.findMany({ where: { campaignId: id }, select: { tier: true, totalQty: true, remainingQty: true, valueVnd: true } }),
    ]);

    const prizeStats = prizes.map(p => ({
      tier: p.tier,
      totalQty: p.totalQty,
      remaining: p.remainingQty,
      disbursed: p.totalQty - p.remainingQty,
    }));

    res.json({ totalTurns, usedTurns, totalPlays, winners, winRate: totalPlays ? winners / totalPlays : 0, prizeStats });
  } catch (e) { next(e); }
});

// Customer play history
router.get('/customers/:cif/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.user.findFirst({ where: { cif: req.params.cif, tenantId: req.user!.tenantId } });
    if (!customer) { res.status(404).json({ error: 'Customer not found' }); return; }

    const plays = await prisma.customerPlay.findMany({
      where: { customerId: customer.id },
      include: { prizePool: { select: { name: true, prizeType: true, valueVnd: true } }, disbursement: { select: { status: true, disbursedAt: true } } },
      orderBy: { playedAt: 'desc' },
      take: 100,
    });
    res.json(plays);
  } catch (e) { next(e); }
});

export default router;
