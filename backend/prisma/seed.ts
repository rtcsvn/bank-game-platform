import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Tenants ─────────────────────────────────────────────
  const msb = await prisma.tenant.upsert({
    where: { slug: 'msb' },
    update: {},
    create: {
      name: 'MSB - Maritime Bank',
      slug: 'msb',
      logoUrl: 'https://assets.msb.com.vn/logo.png',
      themeConfig: {
        primaryColor: '#E31837',
        secondaryColor: '#1A1A2E',
        fontFamily: 'SVN-Gilroy',
        gameSkin: 'birthday-35',
        logoUrl: 'https://assets.msb.com.vn/logo.png',
      },
    },
  });

  const mbb = await prisma.tenant.upsert({
    where: { slug: 'mbb' },
    update: {},
    create: {
      name: 'MB Bank',
      slug: 'mbb',
      themeConfig: {
        primaryColor: '#9B1D97',
        secondaryColor: '#1B1464',
        fontFamily: 'Nunito',
        gameSkin: 'default',
      },
    },
  });

  console.log('✓ Tenants created:', msb.slug, mbb.slug);

  // ── Users ────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hash(pw, 12);

  const superAdmin = await prisma.user.upsert({
    where: { id: 'super-admin-seed' },
    update: {},
    create: {
      id: 'super-admin-seed',
      email: 'superadmin@platform.io',
      passwordHash: await hash('SuperAdmin@123'),
      role: UserRole.SUPER_ADMIN,
    },
  });

  const msbAdmin = await prisma.user.upsert({
    where: { id: 'msb-admin-seed' },
    update: {},
    create: {
      id: 'msb-admin-seed',
      tenantId: msb.id,
      email: 'admin@msb.com.vn',
      passwordHash: await hash('MsbAdmin@123'),
      role: UserRole.BANK_ADMIN,
    },
  });

  const msbMarketing = await prisma.user.upsert({
    where: { id: 'msb-marketing-seed' },
    update: {},
    create: {
      id: 'msb-marketing-seed',
      tenantId: msb.id,
      email: 'marketing@msb.com.vn',
      passwordHash: await hash('Marketing@123'),
      role: UserRole.MARKETING_MANAGER,
    },
  });

  const msbDirector = await prisma.user.upsert({
    where: { id: 'msb-director-seed' },
    update: {},
    create: {
      id: 'msb-director-seed',
      tenantId: msb.id,
      email: 'director@msb.com.vn',
      passwordHash: await hash('Director@123'),
      role: UserRole.MARKETING_DIRECTOR,
    },
  });

  const msbGameOps = await prisma.user.upsert({
    where: { id: 'msb-gameops-seed' },
    update: {},
    create: {
      id: 'msb-gameops-seed',
      tenantId: msb.id,
      email: 'gameops@msb.com.vn',
      passwordHash: await hash('GameOps@123'),
      role: UserRole.GAME_OPS,
    },
  });

  console.log('✓ Users created');

  // ── MSB Birthday 35 Campaign ─────────────────────────────
  const existing = await prisma.campaign.findFirst({ where: { tenantId: msb.id, name: 'Dự Sinh Nhật 35 Năm MSB' } });
  if (!existing) {
    const campaign = await prisma.campaign.create({
      data: {
        tenantId: msb.id,
        name: 'Dự Sinh Nhật 35 Năm MSB',
        description: 'Chương trình chuyển app - 35 năm MSB',
        gameType: 'LUCKY_BOX',
        budgetTotal: 18_655_000_000,
        startAt: new Date('2026-06-01'),
        endAt: new Date('2026-08-31'),
        maxTurnsPerDay: 50,
        createdBy: msbMarketing.id,
        status: 'DRAFT',
      },
    });

    // Game config
    await prisma.gameConfig.create({
      data: {
        campaignId: campaign.id,
        config: {
          skin: 'birthday-35',
          boxAnimation: 'birthday-box',
          revealDurationMs: 2500,
          backgroundMusic: 'birthday-theme.mp3',
          showRemainingPrizes: true,
        },
      },
    });

    // Prize pools (from the MSB document)
    await prisma.prizePool.createMany({
      data: [
        // Mega prizes
        { campaignId: campaign.id, tier: 'MEGA', prizeType: 'PHYSICAL', name: 'Xe ô tô', valueVnd: 600_000_000, totalQty: 1, remainingQty: 1, weight: 1, isActive: false },
        { campaignId: campaign.id, tier: 'MEGA', prizeType: 'MFEST_TICKET', name: 'Vé Mfest', valueVnd: 3_000_000, totalQty: 2000, remainingQty: 2000, weight: 50, isActive: false },
        { campaignId: campaign.id, tier: 'MEGA', prizeType: 'PHYSICAL', name: 'Xe máy (Mega)', valueVnd: 35_000_000, totalQty: 2, remainingQty: 2, weight: 2, isActive: false },
        { campaignId: campaign.id, tier: 'MEGA', prizeType: 'PRETTY_NUMBER', name: 'TKSĐ (Mega)', valueVnd: 35_000_000, totalQty: 2, remainingQty: 2, weight: 2, isActive: false },
        // Monthly prizes
        { campaignId: campaign.id, tier: 'MONTHLY', prizeType: 'PHYSICAL', name: 'Xe máy (Tháng)', valueVnd: 20_000_000, totalQty: 8, remainingQty: 8, weight: 5, isActive: false },
        { campaignId: campaign.id, tier: 'MONTHLY', prizeType: 'PRETTY_NUMBER', name: 'TKSĐ (Tháng)', valueVnd: 20_000_000, totalQty: 8, remainingQty: 8, weight: 5, isActive: false },
        // Daily prizes
        { campaignId: campaign.id, tier: 'DAILY', prizeType: 'PRETTY_NUMBER', name: 'Tài khoản số đẹp', valueVnd: 3_500_000, totalQty: 3000, remainingQty: 3000, weight: 10, isActive: true },
        { campaignId: campaign.id, tier: 'DAILY', prizeType: 'CASH', name: 'Tiền thưởng 3.5tr', valueVnd: 3_500_000, totalQty: 60, remainingQty: 60, weight: 5, isActive: true },
        { campaignId: campaign.id, tier: 'DAILY', prizeType: 'CASH', name: 'Tiền thưởng 350k', valueVnd: 350_000, totalQty: 1200, remainingQty: 1200, weight: 30, isActive: true },
        { campaignId: campaign.id, tier: 'DAILY', prizeType: 'CASH', name: 'Tiền thưởng 35k', valueVnd: 35_000, totalQty: 3000, remainingQty: 3000, weight: 100, isActive: true },
        { campaignId: campaign.id, tier: 'DAILY', prizeType: 'CASH', name: 'Tiền thưởng 10k', valueVnd: 10_000, totalQty: 36000, remainingQty: 36000, weight: 300, isActive: true },
      ],
    });

    // Earn rules (from MSB document)
    await prisma.earnRule.createMany({
      data: [
        { campaignId: campaign.id, productType: 'APP_INSTALL', turnsPerUnit: 1 },
        { campaignId: campaign.id, productType: 'NEW_ACCOUNT', turnsPerUnit: 5 },
        { campaignId: campaign.id, productType: 'FD', minAmount: 5_000_000, turnsPerUnit: 2, unitAmount: 5_000_000, maxTurnsPerMonth: 50 },
        { campaignId: campaign.id, productType: 'CCTG', minAmount: 11_000_000, turnsPerUnit: 5, unitAmount: 11_000_000, maxTurnsPerMonth: 50 },
        { campaignId: campaign.id, productType: 'M_SINH_LOI', minAmount: 20_000_000, turnsPerUnit: 2, unitAmount: 20_000_000, maxTurnsPerMonth: 50 },
        { campaignId: campaign.id, productType: 'USL', minAmount: 50_000_000, turnsPerUnit: 4, unitAmount: 50_000_000, maxTurnsPerMonth: 50 },
        { campaignId: campaign.id, productType: 'CREDIT_CARD', minAmount: 50_000_000, turnsPerUnit: 4, unitAmount: 50_000_000, maxTurnsPerMonth: 50 },
        { campaignId: campaign.id, productType: 'QR_PAYMENT', minAmount: 100_000, turnsPerUnit: 1, maxTurnsPerMonth: 90 },
        { campaignId: campaign.id, productType: 'TRANSFER', minAmount: 50_000, turnsPerUnit: 1 },
      ],
    });

    console.log('✓ MSB Birthday 35 campaign created:', campaign.id);
  }

  console.log('\n🎉 Seed complete!');
  console.log('Accounts:');
  console.log('  superadmin@platform.io  / SuperAdmin@123');
  console.log('  admin@msb.com.vn        / MsbAdmin@123');
  console.log('  marketing@msb.com.vn    / Marketing@123');
  console.log('  director@msb.com.vn     / Director@123');
  console.log('  gameops@msb.com.vn      / GameOps@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
