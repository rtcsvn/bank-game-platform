# Bank Game Platform

Multi-tenant gamification platform for Vietnamese banks. Supports MSB, MBB, SHB, TPB and more — each with isolated campaigns, custom branding, and configurable game mechanics.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+

### 1. Clone & configure
```bash
git clone <repo>
cd bank-game-platform
cp backend/.env.example backend/.env  # edit secrets
```

### 2. Start full stack
```bash
docker-compose up -d
# Wait ~30s for postgres to init and migrations to run
```

Services:
| Service | URL |
|---|---|
| API | http://localhost:4000 |
| Frontend | http://localhost:3000 |
| Adminer (DB UI) | http://localhost:8080 |

### 3. Seed accounts (auto-runs in dev)
| Email | Password | Role |
|---|---|---|
| superadmin@platform.io | SuperAdmin@123 | SUPER_ADMIN |
| admin@msb.com.vn | MsbAdmin@123 | BANK_ADMIN |
| marketing@msb.com.vn | Marketing@123 | MARKETING_MANAGER |
| director@msb.com.vn | Director@123 | MARKETING_DIRECTOR |
| gameops@msb.com.vn | GameOps@123 | GAME_OPS |

---

## Architecture

```
bank-game-platform/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Full DB schema with multi-tenant models
│   │   └── seed.ts             # MSB Birthday 35 campaign sample data
│   ├── scripts/
│   │   ├── init-rls.sql        # PostgreSQL RLS setup
│   │   └── apply-rls.sql       # RLS policies (run after first migration)
│   └── src/
│       ├── config/             # env, logger, prisma, redis singletons
│       ├── middleware/         # auth JWT, RBAC, tenant resolver, rate limiter
│       └── modules/
│           ├── auth/           # Login, refresh tokens, user management
│           ├── tenant/         # Bank config, theme management
│           ├── campaign/       # Full lifecycle: DRAFT→ACTIVE
│           ├── game-engine/    # LUCKY_BOX + LUCKY_DRAW core logic
│           ├── eligibility/    # API rules + CIF Excel upload
│           ├── prize/          # Prize pool management + Game Ops injection
│           ├── budget/         # Multi-source budget allocation
│           ├── notification/   # Push, SMS, in-app (stub - extend as needed)
│           ├── audit/          # Immutable audit log
│           └── report/         # KPIs, dispute resolution, player history
├── frontend/                   # React 18 + Vite + TailwindCSS
└── docs/
    └── ARCHITECTURE.md         # Full system design document
```

## Key Features

### Multi-tenancy
- PostgreSQL Row Level Security (RLS) enforces data isolation
- JWT carries `tenant_id` claim; middleware sets PG session variable
- `SUPER_ADMIN` can switch tenant context via `X-Tenant-Id` header
- Per-bank theme config (colors, logo, game skin, fonts)

### Campaign Lifecycle
```
DRAFT → PENDING_APPROVAL → APPROVED → ACTIVE → PAUSED → ENDED
```
- Marketing Manager creates → Marketing Director approves
- Game Ops activates, pauses, monitors

### Game Engine
- **LUCKY_BOX**: Real-time random draw with atomic Redis lock (no oversell)
- **LUCKY_DRAW**: Scheduled batch lottery with cryptographic RNG seed stored per play
- Idempotency keys prevent double-spend on network retry
- Game Ops can inject Mega prizes into live pool at any time

### Eligibility
- Mode A: JSON rule DSL evaluated against bank core API response
- Mode B: Static Excel upload of CIF numbers
- Mode C: HYBRID (union of both)

### Security
- JWT access tokens (15min) + refresh rotation (7d)
- Distributed locks via Redis (prevent race conditions on prize allocation)
- Immutable audit log (DB-level REVOKE on UPDATE/DELETE)
- Rate limiting: 20 plays/min per customer

## API Reference

### Auth
```
POST /api/v1/auth/login         { email, password, tenantSlug? }
POST /api/v1/auth/refresh       { refreshToken }
POST /api/v1/auth/logout        { refreshToken }
GET  /api/v1/auth/me
```

### Campaigns (Marketing roles)
```
GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
POST   /api/v1/campaigns/:id/submit
POST   /api/v1/campaigns/:id/approve   [DIRECTOR]
POST   /api/v1/campaigns/:id/reject    [DIRECTOR]
POST   /api/v1/campaigns/:id/activate  [GAME_OPS]
POST   /api/v1/campaigns/:id/pause     [GAME_OPS]
```

### Game (Customers + Game Ops)
```
GET  /api/v1/game/campaigns/:id/status
POST /api/v1/game/campaigns/:id/play          { idempotencyKey? }
POST /api/v1/game/campaigns/:id/earn-turns    { customerId, productType, transactionAmount, sourceTxId }
POST /api/v1/game/prizes/:prizePoolId/inject  { qty }  [GAME_OPS]
```

### Eligibility (Game Ops)
```
GET  /api/v1/eligibility/campaigns/:id/check/:cif
POST /api/v1/eligibility/campaigns/:id/upload-cif   [multipart/form-data, field: file]
PUT  /api/v1/eligibility/campaigns/:id/api-rules    { rules: {...} }
```

### Reports
```
GET /api/v1/reports/campaigns/:id/kpis
GET /api/v1/reports/customers/:cif/history
GET /api/v1/audit?action=&entity=&page=&pageSize=
```

## Development

```bash
# Backend only (no Docker)
cd backend
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev

# Frontend only
cd frontend
npm install
npm run dev
```

## Next Steps

- [ ] Frontend: Admin Portal (campaign management, eligibility upload, prize injection)
- [ ] Frontend: Customer Game UI (lucky box animation, turn counter, prize reveal)
- [ ] Frontend: Game Ops Dashboard (live prize counters, budget gauge, draw scheduler)
- [ ] Frontend: Report Dashboard (Recharts KPI visualizations)
- [ ] LUCKY_DRAW scheduler (BullMQ cron job)
- [ ] WebSocket/SSE for real-time prize announcements
- [ ] FCM push notification integration
- [ ] Bank Core API webhook handler
- [ ] Load testing (k6): target 1000 concurrent plays/sec
- [ ] Kubernetes manifests for production deployment
