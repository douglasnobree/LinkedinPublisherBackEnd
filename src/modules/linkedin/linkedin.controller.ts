import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LinkedInService } from './linkedin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('linkedin')
@Controller('linkedin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LinkedInController {
  constructor(private linkedinService: LinkedInService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get LinkedIn profile info' })
  getProfile(@CurrentUser() user: CurrentUserData) {
    return this.linkedinService.getProfile(user.id);
  }

  @Post('test-post')
  @ApiOperation({ summary: 'Test post to LinkedIn (dev only)' })
  async testPost(
    @CurrentUser() user: CurrentUserData,
    @Body('content') content: string,
  ) {
    return this.linkedinService.publishPost(user.id, content);
  }
}
