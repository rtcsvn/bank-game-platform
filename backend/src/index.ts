import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { config } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/error-handler';
import { tenantResolver } from './middleware/tenant-resolver';
import { rateLimiter } from './middleware/rate-limiter';

// Route modules
import authRoutes from './modules/auth/auth.routes';
import tenantRoutes from './modules/tenant/tenant.routes';
import campaignRoutes from './modules/campaign/campaign.routes';
import gameRoutes from './modules/game-engine/game.routes';
import eligibilityRoutes from './modules/eligibility/eligibility.routes';
import prizeRoutes from './modules/prize/prize.routes';
import budgetRoutes from './modules/budget/budget.routes';
import reportRoutes from './modules/report/report.routes';
import auditRoutes from './modules/audit/audit.routes';

const app = express();

// ── Security & parsing middleware ──────────────────────────
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version, ts: new Date() });
});

// ── API routes ─────────────────────────────────────────────
const api = express.Router();

// Public routes (no auth required)
api.use('/auth', authRoutes);

// Authenticated routes — tenant resolved from JWT
api.use(tenantResolver);
api.use('/tenants', tenantRoutes);
api.use('/campaigns', campaignRoutes);
api.use('/game', rateLimiter({ max: 20, windowMs: 60_000 }), gameRoutes);
api.use('/eligibility', eligibilityRoutes);
api.use('/prizes', prizeRoutes);
api.use('/budget', budgetRoutes);
api.use('/reports', reportRoutes);
api.use('/audit', auditRoutes);

app.use('/api/v1', api);

// ── 404 & error handlers ───────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Bank Game Platform API running on port ${PORT} [${config.nodeEnv}]`);
});

export default app;
