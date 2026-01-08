import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user analytics overview' })
  getAnalytics(@CurrentUser() user: CurrentUserData) {
    return this.analyticsService.getUserAnalytics(user.id);
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top performing posts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopPosts(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getTopPerformingPosts(user.id, limit || 10);
  }

  @Get('period')
  @ApiOperation({ summary: 'Get analytics by time period' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getByPeriod(
    @CurrentUser() user: CurrentUserData,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    return this.analyticsService.getAnalyticsByPeriod(user.id, days || 30);
  }

  @Get('personas')
  @ApiOperation({ summary: 'Get performance by persona' })
  getByPersona(@CurrentUser() user: CurrentUserData) {
    return this.analyticsService.getPersonaPerformance(user.id);
  }

  @Get('content/:id')
  @ApiOperation({ summary: 'Get analytics for specific content' })
  getByContent(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.analyticsService.getContentById(id, user.id);
  }
}
