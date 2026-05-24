import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { config } from '../config/env';
import { AppError } from './error-handler';

export interface JwtPayload {
  userId: string;
  tenantId: string | null;
  role: UserRole;
  cif?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing authorization token', 'UNAUTHORIZED'));
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    next();
  };
}

// Shorthand guards
export const requireAdmin = requireRoles(UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN);
export const requireMarketing = requireRoles(
  UserRole.SUPER_ADMIN,
  UserRole.BANK_ADMIN,
  UserRole.MARKETING_MANAGER,
  UserRole.MARKETING_DIRECTOR
);
export const requireGameOps = requireRoles(
  UserRole.SUPER_ADMIN,
  UserRole.BANK_ADMIN,
  UserRole.GAME_OPS
);
export const requireApprover = requireRoles(
  UserRole.SUPER_ADMIN,
  UserRole.BANK_ADMIN,
  UserRole.MARKETING_DIRECTOR
);
