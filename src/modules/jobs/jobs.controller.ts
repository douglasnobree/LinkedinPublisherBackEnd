import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { Role, Persona } from '@prisma/client';

@ApiTags('jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Start content generation job' })
  async startGeneration(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { contentId: string; theme: string; persona?: Persona },
  ) {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    return this.jobsService.createContentGenerationJob({
      contentId: body.contentId,
      userId: user.id,
      theme: body.theme,
      persona: body.persona || Persona.GENERAL,
    });
  }

  @Get('content/:contentId')
  @ApiOperation({ summary: 'Get jobs for a content' })
  getJobsByContent(@Param('contentId', ParseUUIDPipe) contentId: string) {
    return this.jobsService.getJobsByContent(contentId);
  }

  @Get('stats')
  // @UseGuards(RolesGuard)
  // @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get queue statistics (admin only)' })
  getQueueStats() {
    return this.jobsService.getQueueStats();
  }
}
