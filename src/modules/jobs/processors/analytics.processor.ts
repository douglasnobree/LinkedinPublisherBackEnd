import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '../queues.constants';
import { JobsService, AnalyticsJobData } from '../jobs.service';
import { LinkedInService } from '../../linkedin/linkedin.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LoggerService } from '../../../common/services/logger.service';
import { JobStatus } from '@prisma/client';

@Processor(QUEUES.ANALYTICS)
export class AnalyticsProcessor extends WorkerHost {
  constructor(
    private jobsService: JobsService,
    private linkedinService: LinkedInService,
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<AnalyticsJobData & { jobId: string }>): Promise<any> {
    const { contentId, userId, postId, jobId } = job.data;

    this.logger.logJob(jobId, 'ANALYTICS', 'PROCESSING', { postId });

    try {
      await this.jobsService.updateJobStatus(jobId, JobStatus.PROCESSING);

      // Fetch metrics from LinkedIn
      const metrics = await this.linkedinService.getPostMetrics(userId, postId);

      // Calculate engagement rate
      const totalEngagement = metrics.likes + metrics.comments + metrics.shares;
      const engagement = metrics.impressions > 0 
        ? (totalEngagement / metrics.impressions) * 100 
        : 0;

      // Update analytics
      const analytics = await this.prisma.analytics.update({
        where: { contentId },
        data: {
          impressions: metrics.impressions,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          clicks: metrics.clicks,
          engagement,
          fetchedAt: new Date(),
        },
      });

      await this.jobsService.updateJobStatus(jobId, JobStatus.COMPLETED, metrics);
      this.logger.logJob(jobId, 'ANALYTICS', 'COMPLETED', metrics);

      return analytics;
    } catch (error: any) {
      this.logger.error(`Analytics fetch failed: ${error.message}`, error.stack, 'AnalyticsProcessor');
      await this.jobsService.updateJobStatus(jobId, JobStatus.FAILED, null, error.message);
      throw error;
    }
  }
}
