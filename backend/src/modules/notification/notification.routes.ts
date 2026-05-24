import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireGameOps } from '../../middleware/auth';

const router = Router();
router.use(authenticate, requireGameOps);

// Stub: extend with FCM, SMS, WebSocket integration
router.post('/send', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Notification queued (stub)' });
  } catch (e) { next(e); }
});

export default router;
