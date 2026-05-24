/**
 * FULL MOCK DATA SEED
 * Tạo dữ liệu giả lập hoàn chỉnh để demo/test hệ thống:
 * - 3 ngân hàng: MSB, MBB, TPB
 * - 5 chiến dịch với trạng thái khác nhau
 * - 50 khách hàng mock mỗi ngân hàng
 * - Lượt chơi, giải thưởng, audit log mô phỏng thực tế
 */

import { PrismaClient, UserRole, CampaignStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);

// ─── Helpers ──────────────────────────────────────────────

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randDate(daysAgo: number, daysAhead = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo + randInt(0, daysAgo + daysAhead));
  return d;
}

function rngSeed(): string {
  return crypto.randomBytes(8).toString('hex');
}

const VIET_NAMES = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Văn Cường', 'Phạm Thị Dung',
  'Hoàng Văn Em', 'Vũ Thị Phương', 'Đỗ Văn Giang', 'Bùi Thị Hoa',
  'Phan Văn Hùng', 'Ngô Thị Lan', 'Đinh Văn Long', 'Lý Thị Mai',
  'Trương Văn Nam', 'Đặng Thị Oanh', 'Hà Văn Phúc', 'Võ Thị Quỳnh',
  'Tống Văn Sơn', 'Lưu Thị Thanh', 'Cao Văn Tuấn', 'Dương Thị Uyên',
  'Mai Văn Vinh', 'Trịnh Thị Xuân', 'Phùng Văn Yên', 'Khúc Thị Zung',
  'Chu Văn Bảo', 'Thái Thị Cẩm', 'Tạ Văn Đức', 'Từ Thị Gấm',
  'Lộc Văn Hải', 'Kim Thị Ích', 'Kiều Văn Khoa', 'Mạc Thị Liên',
  'Nông Văn Minh', 'Ông Thị Nga', 'Quan Văn Phong', 'Sử Thị Rạng',
  'Tiêu Văn Sang', 'Tô Thị Tuyết', 'Văn Thị Uyên', 'Xa Văn Viên',
  'Âu Thị Yến', 'Âu Dương Hào', 'Tây Mạnh Kiên', 'Đông Thị Linh',
  'Nam Văn Mạnh', 'Bắc Thị Nhung', 'Tây Văn Oanh', 'Trung Thị Phương',
  'Liên Văn Quân', 'Hợp Thị Rừng',
];

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding mock data...\n');

  // ── 1. TENANTS ──────────────────────────────────────────
  const tenants = await Promise.all([
    prisma.tenant.upsert({
      where: { slug: 'msb' },
      update: {},
      create: {
        name: 'MSB – Maritime Bank',
        slug: 'msb',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/MSB_logo.svg/200px-MSB_logo.svg.png',
        themeConfig: {
          primaryColor: '#E31837',
          secondaryColor: '#1A1A2E',
          accentColor: '#FFD700',
          fontFamily: 'SVN-Gilroy, sans-serif',
          gameSkin: 'birthday-35',
          backgroundUrl: 'https://i.imgur.com/msb-bg.jpg',
        },
        isActive: true,
      },
    }),
    prisma.tenant.upsert({
      where: { slug: 'mbb' },
      update: {},
      create: {
        name: 'MB Bank',
        slug: 'mbb',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/MB_bank_logo.png/200px-MB_bank_logo.png',
        themeConfig: {
          primaryColor: '#9B1D97',
          secondaryColor: '#1B1464',
          accentColor: '#F5A623',
          fontFamily: 'Nunito, sans-serif',
          gameSkin: 'purple-galaxy',
          backgroundUrl: 'https://i.imgur.com/mbb-bg.jpg',
        },
        isActive: true,
      },
    }),
    prisma.tenant.upsert({
      where: { slug: 'tpb' },
      update: {},
      create: {
        name: 'TPBank',
        slug: 'tpb',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/TPBank_logo.png/200px-TPBank_logo.png',
        themeConfig: {
          primaryColor: '#00A0DC',
          secondaryColor: '#003087',
          accentColor: '#FF6B00',
          fontFamily: 'Roboto, sans-serif',
          gameSkin: 'ocean-blue',
          backgroundUrl: 'https://i.imgur.com/tpb-bg.jpg',
        },
        isActive: true,
      },
    }),
  ]);

  const [msb, mbb, tpb] = tenants;
  console.log('✅ Tenants:', tenants.map(t => t.slug).join(', '));

  // ── 2. STAFF USERS per tenant ──────────────────────────
  type StaffDef = {
    id: string;
    tenantId: string;
    email: string;
    role: UserRole;
    phone: string;
  };

  const staffDefs: StaffDef[] = [
    // MSB staff
    { id: 'msb-admin',     tenantId: msb.id, email: 'admin@msb.com.vn',     role: 'BANK_ADMIN',           phone: '0901000001' },
    { id: 'msb-mktmgr',   tenantId: msb.id, email: 'marketing@msb.com.vn', role: 'MARKETING_MANAGER',    phone: '0901000002' },
    { id: 'msb-mktdir',   tenantId: msb.id, email: 'director@msb.com.vn',  role: 'MARKETING_DIRECTOR',   phone: '0901000003' },
    { id: 'msb-gameops',  tenantId: msb.id, email: 'gameops@msb.com.vn',   role: 'GAME_OPS',             phone: '0901000004' },
    { id: 'msb-report',   tenantId: msb.id, email: 'report@msb.com.vn',    role: 'REPORT_VIEWER',        phone: '0901000005' },
    // MBB staff
    { id: 'mbb-admin',    tenantId: mbb.id, email: 'admin@mbbank.com.vn',  role: 'BANK_ADMIN',           phone: '0902000001' },
    { id: 'mbb-mktmgr',  tenantId: mbb.id, email: 'mkt@mbbank.com.vn',    role: 'MARKETING_MANAGER',    phone: '0902000002' },
    { id: 'mbb-mktdir',  tenantId: mbb.id, email: 'dir@mbbank.com.vn',    role: 'MARKETING_DIRECTOR',   phone: '0902000003' },
    { id: 'mbb-gameops', tenantId: mbb.id, email: 'ops@mbbank.com.vn',    role: 'GAME_OPS',             phone: '0902000004' },
    // TPB staff
    { id: 'tpb-admin',   tenantId: tpb.id, email: 'admin@tpbank.vn',      role: 'BANK_ADMIN',           phone: '0903000001' },
    { id: 'tpb-mktmgr',  tenantId: tpb.id, email: 'mkt@tpbank.vn',        role: 'MARKETING_MANAGER',    phone: '0903000002' },
    { id: 'tpb-mktdir',  tenantId: tpb.id, email: 'dir@tpbank.vn',        role: 'MARKETING_DIRECTOR',   phone: '0903000003' },
    // Super admin
    { id: 'super-admin', tenantId: '',     email: 'root@platform.io',     role: 'SUPER_ADMIN',          phone: '0900000000' },
  ];

  const pw = await hash('Demo@123456');
  for (const s of staffDefs) {
    await prisma.user.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        tenantId: s.tenantId || null,
        email: s.email,
        phone: s.phone,
        passwordHash: pw,
        role: s.role,
        isActive: true,
        lastLoginAt: randDate(30),
      },
    });
  }
  console.log('✅ Staff users:', staffDefs.length);

  // ── 3. CUSTOMER USERS (50 per bank) ───────────────────
  const allCustomers: { id: string; tenantId: string; cif: string }[] = [];

  for (const tenant of tenants) {
    for (let i = 0; i < 50; i++) {
      const cif = `${tenant.slug.toUpperCase()}${String(1000 + i).padStart(6, '0')}`;
      const userId = `cust-${tenant.slug}-${i}`;
      const name = VIET_NAMES[i % VIET_NAMES.length];
      const phone = `09${randInt(10, 99)}${String(randInt(100000, 999999))}`;

      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          tenantId: tenant.id,
          cif,
          email: `customer${i + 1}@${tenant.slug}.mock`,
          phone,
          passwordHash: pw,
          role: 'CUSTOMER',
          isActive: true,
          lastLoginAt: randDate(14),
        },
      });
      allCustomers.push({ id: userId, tenantId: tenant.id, cif });
    }
  }
  console.log('✅ Customers:', allCustomers.length, 'total (50 per bank)');

  // ── 4. CAMPAIGNS ────────────────────────────────────────

  // Helper: create full campaign with config, prize pools, earn rules
  async function createCampaign(params: {
    tenantId: string;
    createdBy: string;
    approvedBy?: string;
    name: string;
    description: string;
    status: CampaignStatus;
    startAt: Date;
    endAt: Date;
    budgetTotal: number;
    maxTurnsPerDay?: number;
    gameSkin: string;
    prizes: Array<{
      tier: 'MEGA' | 'MONTHLY' | 'DAILY';
      prizeType: 'CASH' | 'VOUCHER' | 'LOYALTY_POINTS' | 'PHYSICAL' | 'PRETTY_NUMBER' | 'MFEST_TICKET';
      name: string;
      valueVnd: number;
      totalQty: number;
      weight: number;
      isActive?: boolean;
    }>;
    earnRules: Array<{
      productType: string;
      minAmount?: number;
      turnsPerUnit: number;
      unitAmount?: number;
    }>;
  }) {
    const c = await prisma.campaign.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        description: params.description,
        gameType: 'LUCKY_BOX',
        status: params.status,
        budgetTotal: params.budgetTotal,
        startAt: params.startAt,
        endAt: params.endAt,
        maxTurnsPerDay: params.maxTurnsPerDay ?? 50,
        createdBy: params.createdBy,
        approvedBy: params.approvedBy ?? null,
        approvedAt: params.approvedBy ? randDate(20, 0) : null,
      },
    });

    await prisma.gameConfig.create({
      data: {
        campaignId: c.id,
        config: {
          skin: params.gameSkin,
          boxAnimation: 'shake-open',
          revealDurationMs: 2200,
          backgroundMusic: 'campaign-theme.mp3',
          showRemainingPrizes: true,
          confettiOnWin: true,
          soundEffects: { open: 'whoosh.mp3', win: 'fanfare.mp3', lose: 'thud.mp3' },
        },
      },
    });

    await prisma.prizePool.createMany({
      data: params.prizes.map(p => ({
        campaignId: c.id,
        tier: p.tier,
        prizeType: p.prizeType,
        name: p.name,
        valueVnd: p.valueVnd,
        totalQty: p.totalQty,
        remainingQty: Math.floor(p.totalQty * randInt(30, 95) / 100),
        weight: p.weight,
        isActive: p.isActive ?? (p.tier === 'DAILY'),
      })),
    });

    await prisma.earnRule.createMany({
      data: params.earnRules.map(r => ({
        campaignId: c.id,
        productType: r.productType as never,
        minAmount: r.minAmount ?? null,
        turnsPerUnit: r.turnsPerUnit,
        unitAmount: r.unitAmount ?? null,
        maxTurnsPerMonth: 90,
        isActive: true,
      })),
    });

    return c;
  }

  // ── Campaign 1: MSB Birthday 35 (ACTIVE) ──────────────
  const msbBirthday = await createCampaign({
    tenantId: msb.id,
    createdBy: 'msb-mktmgr',
    approvedBy: 'msb-mktdir',
    name: 'Dự Sinh Nhật 35 Năm MSB',
    description: 'Mừng sinh nhật 35 năm MSB – Chuyển app nhận quà khủng!',
    status: 'ACTIVE',
    startAt: new Date('2026-06-01'),
    endAt: new Date('2026-08-31'),
    budgetTotal: 18_655_000_000,
    maxTurnsPerDay: 50,
    gameSkin: 'birthday-35',
    prizes: [
      { tier: 'MEGA',    prizeType: 'PHYSICAL',        name: 'Xe ô tô VinFast',     valueVnd: 600_000_000, totalQty: 1,      weight: 1,   isActive: false },
      { tier: 'MEGA',    prizeType: 'MFEST_TICKET',    name: 'Vé Mfest 2026',       valueVnd:   3_000_000, totalQty: 2000,   weight: 50,  isActive: false },
      { tier: 'MEGA',    prizeType: 'PHYSICAL',        name: 'Xe máy Honda',        valueVnd:  35_000_000, totalQty: 2,      weight: 2,   isActive: false },
      { tier: 'MEGA',    prizeType: 'PRETTY_NUMBER',   name: 'TKSĐ Mega',           valueVnd:  35_000_000, totalQty: 2,      weight: 2,   isActive: false },
      { tier: 'MONTHLY', prizeType: 'PHYSICAL',        name: 'Xe máy (Tháng)',      valueVnd:  20_000_000, totalQty: 8,      weight: 5,   isActive: false },
      { tier: 'MONTHLY', prizeType: 'PRETTY_NUMBER',   name: 'TKSĐ (Tháng)',        valueVnd:  20_000_000, totalQty: 8,      weight: 5,   isActive: false },
      { tier: 'DAILY',   prizeType: 'PRETTY_NUMBER',   name: 'Tài khoản số đẹp',   valueVnd:   3_500_000, totalQty: 3000,   weight: 10,  isActive: true  },
      { tier: 'DAILY',   prizeType: 'CASH',            name: 'Tiền thưởng 3.5tr',  valueVnd:   3_500_000, totalQty: 60,     weight: 5,   isActive: true  },
      { tier: 'DAILY',   prizeType: 'CASH',            name: 'Tiền thưởng 350k',   valueVnd:     350_000, totalQty: 1200,   weight: 30,  isActive: true  },
      { tier: 'DAILY',   prizeType: 'CASH',            name: 'Tiền thưởng 35k',    valueVnd:      35_000, totalQty: 3000,   weight: 100, isActive: true  },
      { tier: 'DAILY',   prizeType: 'CASH',            name: 'Tiền thưởng 10k',    valueVnd:      10_000, totalQty: 36000,  weight: 300, isActive: true  },
    ],
    earnRules: [
      { productType: 'APP_INSTALL',  turnsPerUnit: 1 },
      { productType: 'NEW_ACCOUNT',  turnsPerUnit: 5 },
      { productType: 'FD',           minAmount: 5_000_000,  turnsPerUnit: 2, unitAmount: 5_000_000  },
      { productType: 'CCTG',         minAmount: 11_000_000, turnsPerUnit: 5, unitAmount: 11_000_000 },
      { productType: 'M_SINH_LOI',   minAmount: 20_000_000, turnsPerUnit: 2, unitAmount: 20_000_000 },
      { productType: 'USL',          minAmount: 50_000_000, turnsPerUnit: 4, unitAmount: 50_000_000 },
      { productType: 'CREDIT_CARD',  minAmount: 50_000_000, turnsPerUnit: 4, unitAmount: 50_000_000 },
      { productType: 'QR_PAYMENT',   minAmount: 100_000,    turnsPerUnit: 1 },
      { productType: 'TRANSFER',     minAmount: 50_000,     turnsPerUnit: 1 },
    ],
  });

  // ── Campaign 2: MSB Tết draft ──────────────────────────
  await createCampaign({
    tenantId: msb.id,
    createdBy: 'msb-mktmgr',
    name: 'MSB Tết Nguyên Đán 2027 – Xuân Phát Tài',
    description: 'Chiến dịch Tết 2027 (đang soạn thảo)',
    status: 'DRAFT',
    startAt: new Date('2027-01-15'),
    endAt: new Date('2027-02-28'),
    budgetTotal: 10_000_000_000,
    gameSkin: 'tet-2027',
    prizes: [
      { tier: 'MEGA',  prizeType: 'CASH',    name: 'Thưởng Tết 100tr',  valueVnd: 100_000_000, totalQty: 5,    weight: 1   },
      { tier: 'DAILY', prizeType: 'VOUCHER', name: 'Voucher siêu thị',  valueVnd:     500_000, totalQty: 5000, weight: 100 },
      { tier: 'DAILY', prizeType: 'CASH',    name: 'Lì xì 50k',         valueVnd:      50_000, totalQty: 50000,weight: 500 },
    ],
    earnRules: [
      { productType: 'QR_PAYMENT', minAmount: 50_000, turnsPerUnit: 1 },
      { productType: 'TRANSFER',   minAmount: 50_000, turnsPerUnit: 1 },
    ],
  });

  // ── Campaign 3: MBB App Download (PENDING_APPROVAL) ───
  const mbbApp = await createCampaign({
    tenantId: mbb.id,
    createdBy: 'mbb-mktmgr',
    name: 'MBBank – Download App Thắng Ngay',
    description: 'Tải app MB Bank nhận ngay 1 lượt quay số may mắn',
    status: 'PENDING_APPROVAL',
    startAt: new Date('2026-07-01'),
    endAt: new Date('2026-09-30'),
    budgetTotal: 5_000_000_000,
    gameSkin: 'purple-galaxy',
    prizes: [
      { tier: 'MEGA',  prizeType: 'PHYSICAL', name: 'iPhone 16 Pro Max', valueVnd: 35_000_000, totalQty: 10,   weight: 1   },
      { tier: 'DAILY', prizeType: 'VOUCHER',  name: 'Voucher Be 50k',    valueVnd:     50_000, totalQty: 10000,weight: 200 },
      { tier: 'DAILY', prizeType: 'CASH',     name: 'Thưởng 20k',        valueVnd:     20_000, totalQty: 50000,weight: 500 },
    ],
    earnRules: [
      { productType: 'APP_INSTALL', turnsPerUnit: 1 },
      { productType: 'NEW_ACCOUNT', turnsPerUnit: 3 },
    ],
  });

  // ── Campaign 4: TPB Summer (ACTIVE) ───────────────────
  const tpbSummer = await createCampaign({
    tenantId: tpb.id,
    createdBy: 'tpb-mktmgr',
    approvedBy: 'tpb-mktdir',
    name: 'TPBank Summer 2026 – Hè Sôi Động',
    description: 'Giao dịch QR mỗi ngày nhận quà hàng ngàn',
    status: 'ACTIVE',
    startAt: new Date('2026-06-15'),
    endAt: new Date('2026-08-15'),
    budgetTotal: 8_000_000_000,
    gameSkin: 'ocean-blue',
    prizes: [
      { tier: 'MEGA',    prizeType: 'PHYSICAL',      name: 'Xe máy Yamaha',    valueVnd: 40_000_000, totalQty: 3,     weight: 1   },
      { tier: 'MONTHLY', prizeType: 'CASH',          name: 'Thưởng tháng 5tr', valueVnd:  5_000_000, totalQty: 10,    weight: 10  },
      { tier: 'DAILY',   prizeType: 'LOYALTY_POINTS',name: 'Điểm TPBank 5000', valueVnd:     50_000, totalQty: 20000, weight: 200 },
      { tier: 'DAILY',   prizeType: 'VOUCHER',       name: 'Voucher Grab 30k', valueVnd:     30_000, totalQty: 30000, weight: 300 },
      { tier: 'DAILY',   prizeType: 'CASH',          name: 'Thưởng 10k',       valueVnd:     10_000, totalQty: 50000, weight: 500 },
    ],
    earnRules: [
      { productType: 'QR_PAYMENT', minAmount: 50_000,     turnsPerUnit: 1 },
      { productType: 'TRANSFER',   minAmount: 100_000,    turnsPerUnit: 2 },
      { productType: 'FD',         minAmount: 10_000_000, turnsPerUnit: 3, unitAmount: 10_000_000 },
    ],
  });

  // ── Campaign 5: MSB ENDED (historical data) ───────────
  const msbEnded = await createCampaign({
    tenantId: msb.id,
    createdBy: 'msb-mktmgr',
    approvedBy: 'msb-mktdir',
    name: 'MSB Mùa Hè 2025 – Tiết Kiệm Có Lãi',
    description: 'Chiến dịch đã kết thúc – dữ liệu lịch sử',
    status: 'ENDED',
    startAt: new Date('2025-06-01'),
    endAt: new Date('2025-08-31'),
    budgetTotal: 6_000_000_000,
    gameSkin: 'summer-2025',
    prizes: [
      { tier: 'DAILY', prizeType: 'CASH', name: 'Thưởng 50k',  valueVnd: 50_000,  totalQty: 10000, weight: 100, isActive: false },
      { tier: 'DAILY', prizeType: 'CASH', name: 'Thưởng 10k',  valueVnd: 10_000,  totalQty: 50000, weight: 500, isActive: false },
    ],
    earnRules: [
      { productType: 'FD', minAmount: 5_000_000, turnsPerUnit: 1, unitAmount: 5_000_000 },
    ],
  });

  console.log('✅ Campaigns created: 5 (2 MSB, 1 MBB, 1 TPB + 1 MSB ended)');

  // ── 5. ELIGIBLE CUSTOMERS ─────────────────────────────
  const msbCustomers = allCustomers.filter(c => c.tenantId === msb.id);
  const tpbCustomers = allCustomers.filter(c => c.tenantId === tpb.id);

  // Create eligibility configs
  const msbElig = await prisma.eligibilityConfig.upsert({
    where: { campaignId: msbBirthday.id },
    update: {},
    create: { campaignId: msbBirthday.id, mode: 'CIF_UPLOAD' },
  });

  const tpbElig = await prisma.eligibilityConfig.upsert({
    where: { campaignId: tpbSummer.id },
    update: {},
    create: {
      campaignId: tpbSummer.id,
      mode: 'API_RULE',
      apiRules: {
        and: [
          { field: 'isActive', op: 'eq', value: true },
          { or: [
            { field: 'hasQrPayment', op: 'eq', value: true },
            { field: 'accountBalance', op: 'gte', value: 1_000_000 },
          ]},
        ],
      },
    },
  });

  // Add MSB customers as eligible via upload
  await prisma.eligibleCustomer.createMany({
    data: msbCustomers.map(c => ({
      campaignId: msbBirthday.id,
      eligibilityConfigId: msbElig.id,
      customerCif: c.cif,
      source: 'UPLOAD',
      uploadBatchId: 'mock-batch-001',
    })),
    skipDuplicates: true,
  });

  console.log('✅ Eligible customers loaded:', msbCustomers.length, '(MSB) via upload');

  // ── 6. CUSTOMER TURNS ─────────────────────────────────
  const PRODUCT_TYPES = ['QR_PAYMENT', 'TRANSFER', 'FD', 'APP_INSTALL', 'NEW_ACCOUNT'];
  const turnsData: Array<{
    campaignId: string;
    customerId: string;
    sourceTxId: string;
    productType: string;
    status: 'AVAILABLE' | 'USED' | 'EXPIRED';
    createdAt: Date;
    usedAt?: Date;
  }> = [];

  // MSB Birthday: turns for all 50 customers
  for (const customer of msbCustomers) {
    const numTurns = randInt(2, 20);
    for (let t = 0; t < numTurns; t++) {
      const daysAgo = randInt(0, 30);
      const isUsed = Math.random() < 0.65;
      turnsData.push({
        campaignId: msbBirthday.id,
        customerId: customer.id,
        sourceTxId: `TX-MSB-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productType: randItem(PRODUCT_TYPES),
        status: isUsed ? 'USED' : 'AVAILABLE',
        createdAt: randDate(daysAgo),
        ...(isUsed ? { usedAt: randDate(daysAgo - 1) } : {}),
      });
    }
  }

  // TPB Summer: turns for TPB customers
  for (const customer of tpbCustomers.slice(0, 30)) {
    const numTurns = randInt(1, 10);
    for (let t = 0; t < numTurns; t++) {
      const daysAgo = randInt(0, 20);
      const isUsed = Math.random() < 0.5;
      turnsData.push({
        campaignId: tpbSummer.id,
        customerId: customer.id,
        sourceTxId: `TX-TPB-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productType: randItem(['QR_PAYMENT', 'TRANSFER', 'FD']),
        status: isUsed ? 'USED' : 'AVAILABLE',
        createdAt: randDate(daysAgo),
        ...(isUsed ? { usedAt: randDate(daysAgo - 1) } : {}),
      });
    }
  }

  // Insert turns in batches of 100
  for (let i = 0; i < turnsData.length; i += 100) {
    await prisma.customerTurn.createMany({
      data: turnsData.slice(i, i + 100).map(t => ({
        campaignId: t.campaignId,
        customerId: t.customerId,
        sourceTxId: t.sourceTxId,
        productType: t.productType as never,
        status: t.status,
        createdAt: t.createdAt,
        usedAt: t.usedAt ?? null,
      })),
      skipDuplicates: true,
    });
  }
  console.log('✅ Customer turns created:', turnsData.length);

  // ── 7. CUSTOMER PLAYS + DISBURSEMENTS ─────────────────
  const usedTurns = await prisma.customerTurn.findMany({
    where: {
      status: 'USED',
      campaignId: { in: [msbBirthday.id, tpbSummer.id] },
    },
    take: 300,
    orderBy: { createdAt: 'desc' },
  });

  const dailyPrizes = await prisma.prizePool.findMany({
    where: { tier: 'DAILY', isActive: true },
  });
  const msbPrizes = dailyPrizes.filter(p => p.campaignId === msbBirthday.id);
  const tpbPrizes  = dailyPrizes.filter(p => p.campaignId === tpbSummer.id);

  let playsCreated = 0;
  let winnerCount  = 0;

  for (const turn of usedTurns) {
    const isWinner = Math.random() < 0.35;
    const prizes = turn.campaignId === msbBirthday.id ? msbPrizes : tpbPrizes;
    const prize = isWinner && prizes.length ? randItem(prizes) : null;

    const play = await prisma.customerPlay.create({
      data: {
        campaignId: turn.campaignId,
        customerId: turn.customerId,
        turnId: turn.id,
        prizePoolId: prize?.id ?? null,
        rngSeed: rngSeed(),
        isWinner: !!prize,
        playedAt: turn.usedAt ?? turn.createdAt,
      },
    });
    playsCreated++;
    if (prize) winnerCount++;

    // Create disbursement for winners
    if (prize) {
      const statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PROCESSING', 'PENDING'];
      const status = randItem(statuses) as 'COMPLETED' | 'PROCESSING' | 'PENDING';
      await prisma.rewardDisbursement.create({
        data: {
          playId: play.id,
          customerId: turn.customerId,
          prizeType: prize.prizeType,
          valueVnd: prize.valueVnd,
          status,
          voucherCode: prize.prizeType === 'VOUCHER' ? `VOCH-${Math.random().toString(36).slice(2, 10).toUpperCase()}` : null,
          txRef: prize.prizeType === 'CASH' ? `REF-${Date.now()}-${Math.random().toString(36).slice(2)}` : null,
          disbursedAt: status === 'COMPLETED' ? randDate(5) : null,
          attempts: status === 'FAILED' ? randInt(1, 3) : 1,
        },
      });
    }
  }
  console.log(`✅ Plays: ${playsCreated}, Winners: ${winnerCount} (${((winnerCount/playsCreated)*100).toFixed(1)}%)`);

  // ── 8. BUDGET ALLOCATIONS ─────────────────────────────
  await prisma.budgetAllocation.createMany({
    data: [
      { campaignId: msbBirthday.id, source: 'CARD_TEAM',      amount: 8_000_000_000, allocatedBy: 'msb-admin',   note: 'Q2 2026 card marketing budget' },
      { campaignId: msbBirthday.id, source: 'LOYALTY_TEAM',   amount: 5_655_000_000, allocatedBy: 'msb-admin',   note: 'Loyalty points co-funding' },
      { campaignId: msbBirthday.id, source: 'MARKETING_TEAM', amount: 5_000_000_000, allocatedBy: 'msb-mktdir',  note: 'Birthday anniversary allocation' },
      { campaignId: tpbSummer.id,   source: 'MARKETING_TEAM', amount: 8_000_000_000, allocatedBy: 'tpb-admin',   note: 'Summer 2026 budget' },
      { campaignId: mbbApp.id,      source: 'CARD_TEAM',      amount: 5_000_000_000, allocatedBy: 'mbb-admin',   note: 'App acquisition budget' },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Budget allocations created');

  // ── 9. AUDIT LOGS ─────────────────────────────────────
  const auditEvents = [
    // MSB campaign events
    { tenantId: msb.id, actorId: 'msb-mktmgr',  action: 'campaign.created',   entity: 'campaigns', entityId: msbBirthday.id, after: { name: msbBirthday.name, status: 'DRAFT' } },
    { tenantId: msb.id, actorId: 'msb-mktmgr',  action: 'campaign.submitted',  entity: 'campaigns', entityId: msbBirthday.id, after: { status: 'PENDING_APPROVAL' } },
    { tenantId: msb.id, actorId: 'msb-mktdir',  action: 'campaign.approved',   entity: 'campaigns', entityId: msbBirthday.id, after: { status: 'APPROVED' } },
    { tenantId: msb.id, actorId: 'msb-gameops', action: 'campaign.activated',  entity: 'campaigns', entityId: msbBirthday.id, after: { status: 'ACTIVE' } },
    // CIF upload event
    { tenantId: msb.id, actorId: 'msb-gameops', action: 'eligibility.upload',  entity: 'eligible_customers', after: { count: msbCustomers.length, batchId: 'mock-batch-001' } },
    // TPB events
    { tenantId: tpb.id, actorId: 'tpb-mktmgr',  action: 'campaign.created',   entity: 'campaigns', entityId: tpbSummer.id, after: { name: tpbSummer.name } },
    { tenantId: tpb.id, actorId: 'tpb-mktdir',  action: 'campaign.approved',  entity: 'campaigns', entityId: tpbSummer.id },
    { tenantId: tpb.id, actorId: 'tpb-admin',   action: 'campaign.activated', entity: 'campaigns', entityId: tpbSummer.id },
    // MBB events
    { tenantId: mbb.id, actorId: 'mbb-mktmgr',  action: 'campaign.created',   entity: 'campaigns', entityId: mbbApp.id, after: { name: mbbApp.name } },
    { tenantId: mbb.id, actorId: 'mbb-mktmgr',  action: 'campaign.submitted', entity: 'campaigns', entityId: mbbApp.id },
  ];

  await prisma.auditLog.createMany({
    data: auditEvents.map(e => ({
      tenantId: e.tenantId,
      actorId: e.actorId,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      before: null,
      after: (e.after ?? null) as never,
      ipAddress: `10.0.${randInt(1, 10)}.${randInt(1, 255)}`,
      createdAt: randDate(randInt(1, 30)),
    })),
    skipDuplicates: true,
  });
  console.log('✅ Audit logs created:', auditEvents.length, 'events');

  // ── SUMMARY ───────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('🎉  Mock data seeding complete!');
  console.log('═══════════════════════════════════════');
  console.log('\n📋 Login accounts (all password: Demo@123456)');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ Role                 │ Email                            │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ SUPER_ADMIN          │ root@platform.io                 │');
  console.log('│ MSB BANK_ADMIN       │ admin@msb.com.vn                 │');
  console.log('│ MSB MARKETING_MGR    │ marketing@msb.com.vn             │');
  console.log('│ MSB MARKETING_DIR    │ director@msb.com.vn              │');
  console.log('│ MSB GAME_OPS         │ gameops@msb.com.vn               │');
  console.log('│ MSB REPORT_VIEWER    │ report@msb.com.vn                │');
  console.log('│ MBB BANK_ADMIN       │ admin@mbbank.com.vn              │');
  console.log('│ TPB BANK_ADMIN       │ admin@tpbank.vn                  │');
  console.log('│ MSB Customer (CIF)   │ MSB001000 → MSB001049            │');
  console.log('│ MBB Customer (CIF)   │ MBB001000 → MBB001049            │');
  console.log('│ TPB Customer (CIF)   │ TPB001000 → TPB001049            │');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('\n📊 Stats:');
  console.log('   Tenants:    3 (MSB, MBB, TPB)');
  console.log('   Campaigns:  5 (2 ACTIVE, 1 DRAFT, 1 PENDING, 1 ENDED)');
  console.log('   Users:      150 customers + 13 staff');
  console.log('   Turns:     ', turnsData.length);
  console.log('   Plays:     ', playsCreated);
  console.log('   Winners:   ', winnerCount);
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
