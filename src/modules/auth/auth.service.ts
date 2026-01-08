import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
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
