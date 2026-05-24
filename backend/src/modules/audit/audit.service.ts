import { prisma } from '../../config/prisma';

interface AuditParams {
  tenantId?: string | null;
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async log(params: AuditParams): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId ?? null,
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        before: params.before as never ?? undefined,
        after: params.after as never ?? undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  async query(tenantId: string, filters: {
    action?: string;
    entity?: string;
    actorId?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 50 } = filters;
    const where = {
      tenantId,
      ...(filters.action && { action: { contains: filters.action } }),
      ...(filters.entity && { entity: filters.entity }),
      ...(filters.actorId && { actorId: filters.actorId }),
      ...(filters.fromDate || filters.toDate ? {
        createdAt: {
          ...(filters.fromDate && { gte: filters.fromDate }),
          ...(filters.toDate && { lte: filters.toDate }),
        }
      } : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, pages: Math.ceil(total / pageSize), logs };
  }
}

export const auditService = new AuditService();
