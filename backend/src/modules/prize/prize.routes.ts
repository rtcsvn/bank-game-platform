// prize.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireGameOps } from '../../middleware/auth';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authenticate, requireGameOps);

router.get('/campaigns/:id/pools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pools = await prisma.prizePool.findMany({ where: { campaignId: req.params.id } });
    res.json(pools);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ isActive: z.boolean().optional(), weight: z.number().optional() }).parse(req.body);
    const pool = await prisma.prizePool.update({ where: { id: req.params.id }, data: body });
    res.json(pool);
  } catch (e) { next(e); }
});

export default router;
