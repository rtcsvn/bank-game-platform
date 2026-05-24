import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { authenticate, requireAdmin } from '../../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().optional(),
});

const refreshSchema = z.object({ refreshToken: z.string() });

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['BANK_ADMIN','MARKETING_MANAGER','MARKETING_DIRECTOR','GAME_OPS','REPORT_VIEWER']),
  cif: z.string().optional(),
  phone: z.string().optional(),
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body.email, body.password, body.tenantSlug);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (e) { next(e); }
});

// Admin: create staff user within their tenant
router.post('/users', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createUserSchema.parse(req.body);
    const tenantId = req.user!.role === 'SUPER_ADMIN'
      ? (req.body.tenantId ?? null)
      : req.user!.tenantId;
    const user = await authService.createUser({ ...body, tenantId });
    res.status(201).json(user);
  } catch (e) { next(e); }
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json(req.user);
});

export default router;
