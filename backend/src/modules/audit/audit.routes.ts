import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { auditService } from './audit.service';

const router = Router();
router.use(authenticate, requireAdmin);

const querySchema = z.object({
  action: z.string().optional(),
  entity: z.string().optional(),
  actorId: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = querySchema.parse(req.query);
    const result = await auditService.query(req.user!.tenantId!, filters);
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
