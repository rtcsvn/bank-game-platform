import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { eligibilityService } from './eligibility.service';
import { authenticate, requireGameOps } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are accepted'));
    }
  },
});

// Check single customer eligibility
router.get('/campaigns/:id/check/:cif', requireGameOps, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eligible = await eligibilityService.isEligible(req.params.id, req.params.cif);
    res.json({ cif: req.params.cif, eligible });
  } catch (e) { next(e); }
});

// Upload CIF Excel
router.post('/campaigns/:id/upload-cif', requireGameOps, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    const result = await eligibilityService.uploadCifList(
      req.params.id,
      req.file.buffer,
      req.user!.userId,
      req.user!.tenantId!
    );
    res.json(result);
  } catch (e) { next(e); }
});

// Set API rule
router.put('/campaigns/:id/api-rules', requireGameOps, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rules } = z.object({ rules: z.record(z.unknown()) }).parse(req.body);
    await eligibilityService.setApiRules(req.params.id, rules);
    res.json({ message: 'Rules updated' });
  } catch (e) { next(e); }
});

export default router;
