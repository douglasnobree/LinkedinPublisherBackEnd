import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ScheduleStatus } from '@prisma/client';

@ApiTags('scheduler')
@Controller('scheduler')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule content for publishing' })
  schedule(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { contentId: string; scheduledAt: string },
  ) {
    return this.schedulerService.scheduleContent(
      user.id,
      body.contentId,
      new Date(body.scheduledAt),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get user schedules' })
  @ApiQuery({ name: 'status', required: false, enum: ScheduleStatus })
  @ApiQuery({ name: 'upcoming', required: false, type: Boolean })
  getSchedules(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: ScheduleStatus,
    @Query('upcoming') upcoming?: boolean,
  ) {
    return this.schedulerService.getUserSchedules(user.id, { status, upcoming });
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get schedule calendar view' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  getCalendar(
    @CurrentUser() user: CurrentUserData,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    return this.schedulerService.getScheduleCalendar(user.id, year, month);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get schedule by ID' })
  getSchedule(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulerService.getSchedule(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a schedule' })
  cancelSchedule(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulerService.cancelSchedule(user.id, id);
  }
}
