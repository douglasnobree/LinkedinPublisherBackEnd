import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('linkedin')
  @UseGuards(AuthGuard('linkedin'))
  @ApiOperation({ summary: 'Initiate LinkedIn OAuth flow' })
  linkedinAuth() {
    // Guard redirects to LinkedIn
  }

  @Get('linkedin/callback')
  @UseGuards(AuthGuard('linkedin'))
  @ApiOperation({ summary: 'LinkedIn OAuth callback' })
  async linkedinCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.generateTokens(req.user);

    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    
    // Redirect to frontend with tokens
    res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: CurrentUserData) {
    return this.authService.getProfile(user.id);
  }

  @Post('refresh-linkedin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh LinkedIn access token' })
  async refreshLinkedInToken(@CurrentUser() user: CurrentUserData) {
    return this.authService.refreshLinkedInToken(user.id);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout(
    @CurrentUser() user: CurrentUserData,
    @Body() body?: { refreshToken?: string },
    @Res() res?: Response,
  ) {
    // Revoke refresh token if provided
    if (body?.refreshToken) {
      await this.authService.revokeRefreshToken(body.refreshToken);
    } else {
      // Revoke all user tokens
      await this.authService.revokeAllUserTokens(user.id);
    }

    if (res) {
      res.status(HttpStatus.OK).json({ message: 'Logged out successfully' });
    } else {
      return { message: 'Logged out successfully' };
    }
  }
}
