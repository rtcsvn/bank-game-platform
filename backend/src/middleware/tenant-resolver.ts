import { Request, Response, NextFunction } from 'express';
import { authenticate } from './auth';
import { prisma } from '../config/prisma';
import { AppError } from './error-handler';

// Sets Postgres session variable for Row Level Security
export async function setTenantContext(tenantId: string | null): Promise<void> {
  if (tenantId) {
    await prisma.$executeRawUnsafe(`SET app.tenant_id = '${tenantId}'`);
  } else {
    await prisma.$executeRawUnsafe(`SET app.tenant_id = ''`);
  }
}

export function tenantResolver(req: Request, res: Response, next: NextFunction): void {
  authenticate(req, res, async (err) => {
    if (err) return next(err);
    const user = req.user!;

    // SUPER_ADMIN can access any tenant via header override
    if (user.role === 'SUPER_ADMIN' && req.headers['x-tenant-id']) {
      user.tenantId = req.headers['x-tenant-id'] as string;
    }

    // Verify tenant exists and is active
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, isActive: true },
      });
      if (!tenant || !tenant.isActive) {
        return next(new AppError(403, 'Tenant not found or inactive', 'TENANT_INACTIVE'));
      }
    }

    await setTenantContext(user.tenantId);
    next();
  });
}
