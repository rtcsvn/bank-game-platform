# Bank Game Platform — System Architecture

## Overview

Multi-tenant gamification platform for Vietnamese banks. Each bank (MSB, MBB, SHB, TPB, …) runs isolated campaigns with custom branding, game mechanics, and reward pools — all served from a single backend.

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend API | Node.js + Express + TypeScript | Fast iteration, rich ecosystem |
| ORM | Prisma + PostgreSQL | Type-safe queries, row-level security |
| Cache / Locks | Redis (ioredis) | Distributed turn locks, pub/sub |
| Queue | BullMQ (Redis-backed) | Async reward disbursement, notifications |
| Auth | JWT (access 15m + refresh 7d) | Stateless, multi-tenant claim |
| Storage | S3-compatible | CIF excel uploads, game assets |
| Analytics | TimescaleDB hypertable | High-write event stream |
| Frontend | React 18 + Vite + TailwindCSS | Customer game UI + admin portals |
| Container | Docker Compose (dev) / K8s (prod) | Reproducible environments |

---

## Multi-Tenant Strategy

Every DB table carries a `tenant_id` FK to the `tenants` table. PostgreSQL Row Level Security (RLS) policies enforce isolation at the DB layer — even if application code forgets to filter, data cannot leak across banks.

```sql
-- Example RLS policy
CREATE POLICY tenant_isolation ON campaigns
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

JWT claims carry `{ tenant_id, role, user_id }`. The API Gateway middleware sets the PostgreSQL session variable before every query.

---

## Service Modules

### 1. Tenant & Theme Service
- CRUD for banks (MSB, MBB, …)
- Theme config: brand colors, logo URL, font, game skin
- Feature flags per tenant (which game types are enabled)

### 2. Campaign Service
- Lifecycle: `DRAFT → PENDING_APPROVAL → ACTIVE → PAUSED → ENDED`
- RBAC: Marketing Manager creates, Marketing Director approves
- Budget attached at creation; links to one Game Config

### 3. Eligibility Service
- Rule mode A: API-based — call bank core API with CIF, apply rule JSON (product holdings, transaction count, etc.)
- Rule mode B: Static — upload Excel of CIFs; parsed and stored in `eligible_customers` table
- Hybrid: union of both modes

### 4. Game Engine Core
- Plugin architecture: each game type is a strategy class implementing `GameStrategy`
- Supported game types: `LUCKY_BOX` (spin/open box), `LUCKY_DRAW` (scheduled lottery)
- RNG: `crypto.randomBytes` seeded per play — cryptographically secure, auditable seed stored per turn

### 5. Rule Engine
- Configures how transactions → turns earned
- Configurable per campaign: FD deposit ≥ 5M = 2 turns; QR payment ≥ 100K = 1 turn; etc.
- Evaluated by webhook from Bank Core on transaction events

### 6. Prize Allocator
- Maintains weighted prize pool per campaign
- LUCKY_BOX: real-time draw on open — atomic Redis decrement prevents oversell
- LUCKY_DRAW: batch job selects winner codes; livestream-compatible result set
- Game Ops can inject "mega prizes" into the active pool at any time (controlled release)

### 7. Budget & Reward Pool
- Budget sources: Card team allocation, Loyalty team allocation
- Each disbursement debits the pool; prevents over-budget
- Reward types: cash transfer, voucher code, loyalty points, physical prize

### 8. Notification Service
- Triggers: turn earned, prize won, draw upcoming, campaign ending
- Channels: in-app (WebSocket), push (FCM), SMS (configurable gateway)

### 9. Audit Log
- Immutable append-only table (no UPDATE/DELETE via RLS)
- Records: who, what action, before/after JSON, timestamp, IP, tenant
- Powers compliance reports and dispute resolution

### 10. Report & Analytics
- Campaign KPIs: participation rate, turns issued vs used, prize coverage
- Dispute dashboard: per-customer turn history + prize history
- Real-time counters via Redis, historical via TimescaleDB

---

## RBAC Roles

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | Full access across all tenants |
| `BANK_ADMIN` | Full access within their tenant |
| `MARKETING_MANAGER` | Create campaigns (needs approval) |
| `MARKETING_DIRECTOR` | Approve/reject campaigns |
| `GAME_OPS` | Inject prizes, monitor, pause campaigns |
| `REPORT_VIEWER` | Read-only reports and dashboards |
| `CUSTOMER` | Play game, view own history |

---

## Game Flow (LUCKY_BOX)

```
Customer opens app
  → GET /game/campaigns/:id/status          # check eligible, remaining prizes
  → POST /game/play { campaign_id }         # validates turn, calls GameEngine
      → TurnManager.consume(customer, campaign)    # Redis atomic decrement
      → PrizeAllocator.draw(prizePool)             # weighted RNG
      → RewardService.disburse(prize, customer)    # async via BullMQ
      → AuditLog.write(event)
  → SSE/WebSocket push to customer app     # result reveal animation
```

---

## Game Flow (LUCKY_DRAW)

```
Scheduled job (DrawScheduler) at campaign end of month:
  → Fetch all eligible_codes for period
  → Shuffle using cryptographic seed
  → Select N winners per prize tier
  → Mark winning codes in DB (atomic transaction)
  → Notify winners via Notification Service
  → Publish results to CMS for livestream display
```

---

## Database Schema (Core Tables)

```
tenants            — id, name, slug, theme_config JSONB
users              — id, tenant_id, cif, role, phone
campaigns          — id, tenant_id, game_type, status, budget, start_at, end_at
game_configs       — id, campaign_id, config JSONB (game-specific rules)
prize_pools        — id, campaign_id, prize_type, value, total_qty, remaining_qty
customer_turns     — id, campaign_id, customer_id, source_tx_id, status
customer_plays     — id, campaign_id, customer_id, turn_id, prize_id, played_at, rng_seed
eligible_customers — id, campaign_id, customer_cif, source (API | UPLOAD)
reward_disbursements — id, play_id, prize_id, status, disbursed_at
audit_logs         — id, tenant_id, actor_id, action, entity, before, after, created_at
```

---

## Security

- **RLS** enforces tenant isolation at DB level
- **JWT** with short-lived access tokens (15 min)
- **Rate limiting** on `/game/play` (Redis token bucket, 10 req/min per customer)
- **Idempotency keys** on play requests prevent double-spend on network retry
- **RNG seeds** stored in `customer_plays` for full auditability
- **HTTPS only** in production; CSP headers on frontend
- **RBAC middleware** on every admin route

---

## Deployment

```
docker-compose.yml
  ├── api (Node.js)          → port 4000
  ├── worker (BullMQ)        → background jobs
  ├── postgres               → port 5432
  ├── redis                  → port 6379
  ├── frontend (Vite/Nginx)  → port 3000
  └── adminer (dev only)     → port 8080
```

Production: Kubernetes with horizontal pod autoscaling on `api` and `worker` services.

---

## Development Phases

| Phase | Deliverable |
|---|---|
| 1 (now) | DB schema + Prisma models + seed data |
| 2 | Auth service + RBAC middleware |
| 3 | Tenant & Theme service |
| 4 | Campaign CRUD + approval workflow |
| 5 | Eligibility service (API + Excel upload) |
| 6 | Game Engine (LuckyBox + LuckyDraw) |
| 7 | Prize Allocator + Budget service |
| 8 | Notification + Audit Log |
| 9 | Admin Portal (React) |
| 10 | Customer Game UI (React) |
| 11 | Report & Analytics dashboard |
| 12 | E2E tests + load testing |
