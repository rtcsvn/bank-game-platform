import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireGameOps } from '../../middleware/auth';
import { gameEngine } from './game-engine.service';

const router = Router();

// All game routes require auth
router.use(authenticate);

// GET /game/campaigns/:id/status — campaign status + turn balance
router.get('/campaigns/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, tenantId } = req.user!;
    const balance = await gameEngine.getTurnBalance(id, userId);
    res.json({ campaignId: id, turnBalance: balance, tenantId });
  } catch (e) { next(e); }
});

// POST /game/campaigns/:id/play — lucky box open
const playSchema = z.object({
  idempotencyKey: z.string().optional(),
});

router.post('/campaigns/:id/play', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: campaignId } = req.params;
    const { idempotencyKey } = playSchema.parse(req.body);
    const { userId, tenantId } = req.user!;

    const result = await gameEngine.playLuckyBox({
      campaignId,
      customerId: userId,
      tenantId: tenantId!,
      idempotencyKey,
    });

    res.json(result);
  } catch (e) { next(e); }
});

// POST /game/campaigns/:id/earn-turns — bank core webhook
const earnSchema = z.object({
  customerId: z.string(),
  productType: z.string(),
  transactionAmount: z.number().positive(),
  sourceTxId: z.string(),
});

router.post('/campaigns/:id/earn-turns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: campaignId } = req.params;
    const body = earnSchema.parse(req.body);
    const { tenantId } = req.user!;

    const result = await gameEngine.earnTurns({
      campaignId,
      tenantId: tenantId!,
      ...body,
    });
    res.json(result);
  } catch (e) { next(e); }
});

// POST /game/prizes/:prizePoolId/inject — Game Ops only
const injectSchema = z.object({ qty: z.number().int().positive() });

router.post('/prizes/:prizePoolId/inject', requireGameOps, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prizePoolId } = req.params;
    const { qty } = injectSchema.parse(req.body);
    const campaignId = req.query.campaignId as string;
    const { userId, tenantId } = req.user!;

    await gameEngine.injectPrize({
      campaignId,
      prizePoolId,
      qty,
      injectedBy: userId,
      tenantId: tenantId!,
    });
    res.json({ message: `Injected ${qty} prizes into pool ${prizePoolId}` });
  } catch (e) { next(e); }
});

export default router;
