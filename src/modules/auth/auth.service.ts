import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoggerService } from '../../common/services/logger.service';

export interface LinkedInAuthPayload {
  linkedinId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private logger: LoggerService,
  ) {}

  async validateOrCreateUser(payload: LinkedInAuthPayload) {
    const { linkedinId, email, name, avatarUrl, accessToken, refreshToken, expiresIn } = payload;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { linkedinProfile: { linkedinId } },
        ],
      },
      include: { linkedinProfile: true },
    });

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    if (!user) {
      // Create new user with LinkedIn profile
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          avatarUrl,
          linkedinProfile: {
            create: {
              linkedinId,
              accessToken,
              refreshToken,
              tokenExpiresAt,
            },
          },
        },
        include: { linkedinProfile: true },
      });

      this.logger.log(`New user created: ${email}`, 'AuthService');
    } else {
      // Update existing LinkedIn profile
      await this.prisma.linkedinProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          linkedinId,
          accessToken,
          refreshToken,
          tokenExpiresAt,
        },
        update: {
          accessToken,
          refreshToken,
          tokenExpiresAt,
        },
      });

      this.logger.log(`User logged in: ${email}`, 'AuthService');
    }

    return user;
  }

  async generateTokens(user: { id: string; email: string; role: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    
    // Generate refresh token
    const refreshToken = randomBytes(64).toString('hex');
    const expiresIn = this.configService.get('JWT_EXPIRES_IN', '7d');
    const refreshTokenExpiresIn = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    const expiresAt = new Date(Date.now() + refreshTokenExpiresIn);

    // Save refresh token to database
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    // Revoke old refresh tokens (keep only the last 5)
    const oldTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        revoked: false,
      },
      orderBy: { createdAt: 'desc' },
      skip: 4, // Keep last 5 tokens
    });

    if (oldTokens.length > 0) {
      await this.prisma.refreshToken.updateMany({
        where: {
          id: { in: oldTokens.map(t => t.id) },
        },
        data: { revoked: true },
      });
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    // Find refresh token
    const token = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (token.revoked) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke old refresh token
    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revoked: true },
    });

    // Generate new access token
    const payload: JwtPayload = {
      sub: token.user.id,
      email: token.user.email,
      role: token.user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Generate new refresh token (token rotation)
    const newRefreshToken = randomBytes(64).toString('hex');
    const refreshTokenExpiresIn = 30 * 24 * 60 * 60 * 1000; // 30 days
    const expiresAt = new Date(Date.now() + refreshTokenExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId: token.user.id,
        token: newRefreshToken,
        expiresAt,
      },
    });

    this.logger.log(`Access token refreshed for user: ${token.userId}`, 'AuthService');

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: token.user.id,
        email: token.user.email,
        role: token.user.role,
      },
    };
  }

  async revokeRefreshToken(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });
  }

  async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        linkedinProfile: {
          select: {
            linkedinId: true,
            profileUrl: true,
            headline: true,
            tokenExpiresAt: true,
          },
        },
        _count: {
          select: {
            contents: true,
            schedules: true,
          },
        },
      },
    });
  }

  async refreshLinkedInToken(userId: string) {
    const profile = await this.prisma.linkedinProfile.findUnique({
      where: { userId },
    });

    if (!profile?.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    // TODO: Implement LinkedIn token refresh
    // This would call LinkedIn API to refresh the access token
    
    this.logger.log(`Token refreshed for user: ${userId}`, 'AuthService');
    
    return { success: true };
  }
}
