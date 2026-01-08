import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { JobsService } from '../jobs/jobs.service';
import { LoggerService } from '../../common/services/logger.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SchedulerTask {
  constructor(
    private schedulerService: SchedulerService,
    @Inject(forwardRef(() => JobsService))
    private jobsService: JobsService,
    private logger: LoggerService,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledPosts() {
    try {
      const dueSchedules = await this.schedulerService.getDueSchedules();

      if (dueSchedules.length === 0) return;

      this.logger.log(
        `Processing ${dueSchedules.length} due schedules`,
        'SchedulerTask',
      );

      for (const schedule of dueSchedules) {
        if (!schedule.user.linkedinProfile) {
          this.logger.warn(
            `User ${schedule.userId} has no LinkedIn profile connected`,
            'SchedulerTask',
          );
          continue;
        }

        const autoComment = this.configService.get('FEATURE_AUTO_COMMENT') === 'true';

        await this.jobsService.createPublishJob({
          contentId: schedule.contentId,
          userId: schedule.userId,
          scheduleId: schedule.id,
          autoComment,
        });

        this.logger.log(
          `Publish job created for schedule ${schedule.id}`,
          'SchedulerTask',
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Scheduler task failed: ${error.message}`,
        error.stack,
        'SchedulerTask',
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshAnalytics() {
    try {
      // Get all published posts from last 7 days
      // and refresh their analytics
      this.logger.log('Refreshing analytics for recent posts', 'SchedulerTask');
      
      // TODO: Implement batch analytics refresh
    } catch (error: any) {
      this.logger.error(
        `Analytics refresh failed: ${error.message}`,
        error.stack,
        'SchedulerTask',
      );
    }
  }
}
