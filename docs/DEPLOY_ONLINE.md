# 🚀 Hướng dẫn chạy online nhanh nhất

Tổng thời gian setup: **~15 phút**. Tất cả dịch vụ đều có **free tier**.

---

## Kiến trúc deploy

```
GitHub Repo
    │
    ├─── Railway ──────── Backend API (Node.js) + PostgreSQL + Redis
    │                     ↳ URL: https://bank-game-api.up.railway.app
    │
    └─── Vercel ────────── Frontend (React/Vite)  [phase sau]
                          ↳ URL: https://bank-game.vercel.app
```

---

## BƯỚC 1 — Database: Neon PostgreSQL (Free)

> Neon là PostgreSQL serverless, free tier 0.5GB, không cần credit card.

1. Vào **https://neon.tech** → Sign up bằng GitHub
2. **New Project** → đặt tên `bank-game-platform` → Region: `Singapore (ap-southeast-1)`
3. Sau khi tạo xong, copy **Connection string** dạng:
   ```
   postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Giữ lại string này cho bước 3.

---

## BƯỚC 2 — Redis: Upstash (Free)

> Upstash Redis serverless, free tier 10K req/ngày, không cần credit card.

1. Vào **https://console.upstash.com** → Sign up bằng GitHub
2. **Create Database** → Name: `bank-game-redis` → Region: `Singapore`
3. Copy **REDIS_URL** dạng:
   ```
   rediss://default:xxxxxxxx@apn1-xxxxx.upstash.io:6379
   ```
4. Giữ lại string này cho bước 3.

---

## BƯỚC 3 — Backend API: Railway (Free $5 credit/tháng)

> Railway deploy Node.js từ GitHub repo, tự động detect và build.

1. Vào **https://railway.app** → Sign up bằng GitHub
2. **New Project** → **Deploy from GitHub repo**
3. Chọn repo `rtcsvn/bank-game-platform`
4. Railway sẽ hỏi root directory → nhập: `backend`
5. Tab **Variables** → Add các biến sau:

```
NODE_ENV                = production
PORT                    = 4000
DATABASE_URL            = [paste Neon connection string]
REDIS_URL               = [paste Upstash URL]
JWT_ACCESS_SECRET       = [random 64 ký tự – dùng: openssl rand -hex 32]
JWT_REFRESH_SECRET      = [random 64 ký tự khác – dùng: openssl rand -hex 32]
JWT_ACCESS_EXPIRES_IN   = 15m
JWT_REFRESH_EXPIRES_IN  = 7d
CORS_ORIGINS            = https://bank-game.vercel.app,http://localhost:3000
```

6. Tab **Settings** → **Start Command**:
   ```
   npx prisma migrate deploy && node dist/index.js
   ```
7. Tab **Settings** → **Build Command**:
   ```
   npm install && npm run build
   ```
8. Click **Deploy** → chờ ~2 phút
9. Tab **Settings** → copy **Public URL** (dạng `https://bank-game-api-xxx.up.railway.app`)

---

## BƯỚC 4 — Chạy Migration + Seed data

Sau khi Railway deploy xong, chạy migration và seed từ local:

```bash
# Clone repo về local
git clone https://github.com/rtcsvn/bank-game-platform
cd bank-game-platform/backend

# Cài dependencies
npm install

# Tạo file .env với Neon DATABASE_URL
cp .env.example .env
# Sửa .env: paste DATABASE_URL từ Neon, REDIS_URL từ Upstash

# Chạy migration
npx prisma migrate dev --name init

# Chạy seed cơ bản
npm run db:seed

# Chạy mock data đầy đủ (150 khách hàng, 5 chiến dịch, lượt chơi...)
npm run db:mock
```

**Kết quả sau khi seed:**
```
✅ Tenants: msb, mbb, tpb
✅ Staff users: 13
✅ Customers: 150 total (50 per bank)
✅ Campaigns: 5 (2 ACTIVE, 1 DRAFT, 1 PENDING, 1 ENDED)
✅ Customer turns created: ~650
✅ Plays: ~300, Winners: ~105 (35%)
✅ Budget allocations created
✅ Audit logs: 10 events
```

---

## BƯỚC 5 — Test API ngay

Thay `BASE_URL` = Railway URL của bạn.

### Login lấy token:
```bash
curl -X POST https://BASE_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@msb.com.vn","password":"Demo@123456","tenantSlug":"msb"}'
```

### Xem danh sách campaigns:
```bash
curl https://BASE_URL/api/v1/campaigns \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Xem KPI campaign:
```bash
curl https://BASE_URL/api/v1/reports/campaigns/CAMPAIGN_ID/kpis \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Kiểm tra số dư lượt chơi:
```bash
curl https://BASE_URL/api/v1/game/campaigns/CAMPAIGN_ID/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## BƯỚC 6 — Xem Database (Prisma Studio)

```bash
cd backend
npx prisma studio
# Mở http://localhost:5555 – UI duyệt toàn bộ database
```

---

## Tài khoản test (tất cả password: `Demo@123456`)

| Role               | Email                    | Tenant |
|--------------------|--------------------------|--------|
| SUPER_ADMIN        | root@platform.io         | All    |
| BANK_ADMIN         | admin@msb.com.vn         | MSB    |
| MARKETING_MANAGER  | marketing@msb.com.vn     | MSB    |
| MARKETING_DIRECTOR | director@msb.com.vn      | MSB    |
| GAME_OPS           | gameops@msb.com.vn       | MSB    |
| REPORT_VIEWER      | report@msb.com.vn        | MSB    |
| BANK_ADMIN         | admin@mbbank.com.vn      | MBB    |
| BANK_ADMIN         | admin@tpbank.vn          | TPB    |

---

## Troubleshooting

**Railway build fails?**
→ Kiểm tra `backend/package.json` có script `build: tsc`
→ Thêm `Procfile` trong thư mục `backend`:
```
web: npm start
```

**Prisma migration lỗi SSL?**
→ Đảm bảo DATABASE_URL có `?sslmode=require` ở cuối (Neon yêu cầu SSL)

**Redis connection timeout?**
→ Upstash URL phải dùng `rediss://` (có s) không phải `redis://`

**CORS error từ frontend?**
→ Thêm Vercel URL vào biến `CORS_ORIGINS` trên Railway
