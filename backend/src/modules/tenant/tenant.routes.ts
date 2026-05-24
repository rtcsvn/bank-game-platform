import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.service';

const router = Router();
router.use(authenticate);

// List tenants (SUPER_ADMIN only)
router.get('/', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
    res.json(tenants);
  } catch (e) { next(e); }
});

// Create tenant
const tenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().optional(),
  themeConfig: z.record(z.unknown()).optional(),
});

router.post('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = tenantSchema.parse(req.body);
    const tenant = await prisma.tenant.create({ data: { ...body, themeConfig: body.themeConfig ?? {} } });
    await auditService.log({ actorId: req.user!.userId, action: 'tenant.created', entity: 'tenants', entityId: tenant.id });
    res.status(201).json(tenant);
  } catch (e) { next(e); }
});

// Update theme config
router.patch('/:id/theme', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { themeConfig } = z.object({ themeConfig: z.record(z.unknown()) }).parse(req.body);
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data: { themeConfig } });
    res.json(tenant);
  } catch (e) { next(e); }
});

export default router;
