import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, forwardRef } from '@nestjs/common';
import { QUEUES } from '../queues.constants';
import { JobsService, PublishJobData } from '../jobs.service';
import { LinkedInService } from '../../linkedin/linkedin.service';
import { ContentService } from '../../content/content.service';
import { AIService } from '../../ai/ai.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LoggerService } from '../../../common/services/logger.service';
import { JobStatus, ContentStatus, ScheduleStatus } from '@prisma/client';

@Processor(QUEUES.PUBLISH)
export class PublishProcessor extends WorkerHost {
  constructor(
    private jobsService: JobsService,
    private linkedinService: LinkedInService,
    @Inject(forwardRef(() => ContentService))
    private contentService: ContentService,
    private aiService: AIService,
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<PublishJobData & { jobId: string }>): Promise<any> {
    const { contentId, userId, scheduleId, autoComment, jobId } = job.data;

    this.logger.logJob(jobId, 'PUBLISH', 'PROCESSING', { contentId });

    try {
      await this.jobsService.updateJobStatus(jobId, JobStatus.PROCESSING);

      // Update schedule status
      await this.prisma.schedule.update({
        where: { id: scheduleId },
        data: { status: ScheduleStatus.PROCESSING },
      });

      // Get content
      const content = await this.contentService.findOne(contentId, userId);
      if (!content.finalContent) {
        throw new Error('No final content to publish');
      }

      // Publish to LinkedIn (with image if available)
      const post = await this.linkedinService.publishPost(
        userId,
        content.finalContent,
        content.imageUrl || undefined,
      );

      // Update content status
      await this.contentService.updateStatus(contentId, ContentStatus.PUBLISHED);

      // Update schedule
      await this.prisma.schedule.update({
        where: { id: scheduleId },
        data: {
          status: ScheduleStatus.COMPLETED,
          publishedAt: new Date(),
        },
      });

      // Create analytics record
      await this.prisma.analytics.create({
        data: {
          userId,
          contentId,
          postId: post.postId,
        },
      });

      // Auto-comment if enabled
      if (autoComment) {
        const comment = await this.aiService.generateAutoComment(content.finalContent);
        await this.linkedinService.postComment(userId, post.postId, comment.content);
      }

      await this.jobsService.updateJobStatus(jobId, JobStatus.COMPLETED, { postId: post.postId, url: post.url });
      this.logger.logJob(jobId, 'PUBLISH', 'COMPLETED', { postId: post.postId });

      // Schedule analytics fetch
      await this.jobsService.createAnalyticsJob({
        contentId,
        userId,
        postId: post.postId,
      });

      return post;
    } catch (error: any) {
      this.logger.error(`Publish failed: ${error.message}`, error.stack, 'PublishProcessor');

      // Update schedule with error
      await this.prisma.schedule.update({
        where: { id: scheduleId },
        data: {
          status: ScheduleStatus.FAILED,
          lastError: error.message,
          retryCount: { increment: 1 },
        },
      });

      await this.jobsService.updateJobStatus(jobId, JobStatus.FAILED, null, error.message);
      throw error;
    }
  }
}
