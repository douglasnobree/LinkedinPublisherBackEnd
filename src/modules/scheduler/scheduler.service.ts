import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoggerService } from '../../common/services/logger.service';
import { ScheduleStatus, ContentStatus } from '@prisma/client';

@Injectable()
export class SchedulerService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {}

  async scheduleContent(
    userId: string,
    contentId: string,
    scheduledAt: Date,
  ) {
    // Validate content exists and is ready
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, userId },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (content.status !== ContentStatus.REVIEW && content.status !== ContentStatus.DRAFT) {
      throw new BadRequestException('Content cannot be scheduled in current status');
    }

    if (!content.finalContent) {
      throw new BadRequestException('Content must be generated before scheduling');
    }

    // Check for existing schedule
    const existing = await this.prisma.schedule.findUnique({
      where: { contentId },
    });

    if (existing) {
      // Update existing schedule
      const schedule = await this.prisma.schedule.update({
        where: { contentId },
        data: {
          scheduledAt,
          status: ScheduleStatus.PENDING,
        },
      });

      this.logger.log(`Schedule updated: ${schedule.id}`, 'SchedulerService');
      return schedule;
    }

    // Create new schedule
    const schedule = await this.prisma.schedule.create({
      data: {
        userId,
        contentId,
        scheduledAt,
        status: ScheduleStatus.PENDING,
      },
    });

    await this.prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.SCHEDULED },
    });

    this.logger.log(`Content scheduled: ${contentId} for ${scheduledAt}`, 'SchedulerService');
    return schedule;
  }

  async getSchedule(userId: string, scheduleId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, userId },
      include: { content: true },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async getUserSchedules(userId: string, options: {
    status?: ScheduleStatus;
    upcoming?: boolean;
  } = {}) {
    const { status, upcoming } = options;

    return this.prisma.schedule.findMany({
      where: {
        userId,
        ...(status && { status }),
        ...(upcoming && {
          scheduledAt: { gte: new Date() },
          status: ScheduleStatus.PENDING,
        }),
      },
      include: {
        content: {
          select: {
            id: true,
            theme: true,
            persona: true,
            finalContent: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async cancelSchedule(userId: string, scheduleId: string) {
    const schedule = await this.getSchedule(userId, scheduleId);

    if (schedule.status !== ScheduleStatus.PENDING) {
      throw new BadRequestException('Only pending schedules can be cancelled');
    }

    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: ScheduleStatus.CANCELLED },
    });

    await this.prisma.content.update({
      where: { id: schedule.contentId },
      data: { status: ContentStatus.REVIEW },
    });

    this.logger.log(`Schedule cancelled: ${scheduleId}`, 'SchedulerService');
    return { success: true };
  }

  async getDueSchedules() {
    return this.prisma.schedule.findMany({
      where: {
        status: ScheduleStatus.PENDING,
        scheduledAt: { lte: new Date() },
      },
      include: {
        content: true,
        user: {
          include: { linkedinProfile: true },
        },
      },
    });
  }

  async getScheduleCalendar(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        userId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        content: {
          select: {
            id: true,
            theme: true,
            persona: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Group by day
    const calendar: Record<string, any[]> = {};
    schedules.forEach((s) => {
      const day = s.scheduledAt.getDate().toString();
      if (!calendar[day]) calendar[day] = [];
      calendar[day].push(s);
    });

    return calendar;
  }
}
