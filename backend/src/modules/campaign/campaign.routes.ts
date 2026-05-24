import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { campaignService, createCampaignSchema } from './campaign.service';
import { authenticate, requireMarketing, requireApprover, requireGameOps } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// List campaigns for tenant
router.get('/', requireMarketing, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, gameType } = req.query as Record<string, string>;
    const campaigns = await campaignService.list(req.user!.tenantId!, { status: status as never, gameType: gameType as never });
    res.json(campaigns);
  } catch (e) { next(e); }
});

// Create campaign
router.post('/', requireMarketing, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createCampaignSchema.parse(req.body);
    const campaign = await campaignService.create(input, req.user!.userId, req.user!.tenantId!);
    res.status(201).json(campaign);
  } catch (e) { next(e); }
});

// Get single campaign
router.get('/:id', requireMarketing, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await campaignService.getById(req.params.id, req.user!.tenantId!);
    res.json(c);
  } catch (e) { next(e); }
});

// Lifecycle transitions
router.post('/:id/submit', requireMarketing, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await campaignService.submitForApproval(req.params.id, req.user!.userId, req.user!.tenantId!);
    res.json(c);
  } catch (e) { next(e); }
});

router.post('/:id/approve', requireApprover, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await campaignService.approve(req.params.id, req.user!.userId, req.user!.tenantId!);
    res.json(c);
  } catch (e) { next(e); }
});

router.post('/:id/reject', requireApprover, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { note } = z.object({ note: z.string().min(5) }).parse(req.body);
    const c = await campaignService.reject(req.params.id, req.user!.userId, req.user!.tenantId!, note);
    res.json(c);
  } catch (e) { next(e); }
});

router.post('/:id/activate', requireGameOps, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await campaignService.activate(req.params.id, req.user!.userId, req.user!.tenantId!);
    res.json(c);
  } catch (e) { next(e); }
});

router.post('/:id/pause', requireGameOps, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await campaignService.pause(req.params.id, req.user!.userId, req.user!.tenantId!);
    res.json(c);
  } catch (e) { next(e); }
});

export default router;
