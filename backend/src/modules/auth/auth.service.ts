import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { config } from '../../config/env';
import { AppError } from '../../middleware/error-handler';
import { JwtPayload } from '../../middleware/auth';

const SALT_ROUNDS = 12;

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  signAccessToken(user: Pick<User, 'id' | 'tenantId' | 'role' | 'cif'>): string {
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      cif: user.cif ?? undefined,
    };
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn,
    } as jwt.SignOptions);
  }

  signRefreshToken(userId: string): string {
    return jwt.sign({ userId }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);
  }

  async login(email: string, password: string, tenantSlug?: string) {
    // Resolve tenant if provided
    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, isActive: true },
      });
      if (!tenant || !tenant.isActive) throw new AppError(401, 'Invalid credentials', 'AUTH_FAILED');
      tenantId = tenant.id;
    }

    const user = await prisma.user.findFirst({
      where: { email, tenantId, isActive: true },
    });

    if (!user || !user.passwordHash) throw new AppError(401, 'Invalid credentials', 'AUTH_FAILED');

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials', 'AUTH_FAILED');

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.signAccessToken(user);
    const refreshTokenRaw = this.signRefreshToken(user.id);

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshTokenRaw, expiresAt },
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { userId: string };
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };
    } catch {
      throw new AppError(401, 'Invalid refresh token', 'UNAUTHORIZED');
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError(401, 'Refresh token expired or revoked', 'UNAUTHORIZED');
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = this.signAccessToken(stored.user);
    const newRefreshToken = this.signRefreshToken(payload.userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { userId: payload.userId, token: newRefreshToken, expiresAt },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  async createUser(data: {
    tenantId: string | null;
    email: string;
    password: string;
    role: UserRole;
    cif?: string;
    phone?: string;
  }) {
    const passwordHash = await this.hashPassword(data.password);
    return prisma.user.create({
      data: {
        tenantId: data.tenantId,
        email: data.email,
        passwordHash,
        role: data.role,
        cif: data.cif,
        phone: data.phone,
      },
      select: { id: true, email: true, role: true, tenantId: true, createdAt: true },
    });
  }
}

export const authService = new AuthService();
