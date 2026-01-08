import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoggerService } from '../../common/services/logger.service';
import { QUEUES } from './queues.constants';
import { JobType, JobStatus, Persona } from '@prisma/client';

export interface ContentGenerationJobData {
  contentId: string;
  userId: string;
  theme: string;
  persona: Persona;
  step: 'outline' | 'post' | 'polish';
}

export interface PublishJobData {
  contentId: string;
  userId: string;
  scheduleId: string;
  autoComment?: boolean;
}

export interface AnalyticsJobData {
  contentId: string;
  userId: string;
  postId: string;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(QUEUES.CONTENT_GENERATION) private contentQueue: Queue,
    @InjectQueue(QUEUES.PUBLISH) private publishQueue: Queue,
    @InjectQueue(QUEUES.ANALYTICS) private analyticsQueue: Queue,
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {}

  async createContentGenerationJob(data: Omit<ContentGenerationJobData, 'step'>) {
    const job = await this.prisma.job.create({
      data: {
        contentId: data.contentId,
        type: JobType.GENERATE_OUTLINE,
        status: JobStatus.PENDING,
        payload: data as any,
      },
    });

    await this.contentQueue.add(
      'generate',
      { ...data, step: 'outline', jobId: job.id },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.logger.logJob(job.id, 'CONTENT_GENERATION', 'QUEUED', { contentId: data.contentId });
    return job;
  }

  async createNextStepJob(data: ContentGenerationJobData, nextStep: 'post' | 'polish') {
    const jobType = nextStep === 'post' ? JobType.GENERATE_CONTENT : JobType.POLISH_CONTENT;
    
    const job = await this.prisma.job.create({
      data: {
        contentId: data.contentId,
        type: jobType,
        status: JobStatus.PENDING,
        payload: { ...data, step: nextStep } as any,
      },
    });

    await this.contentQueue.add(
      'generate',
      { ...data, step: nextStep, jobId: job.id },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.logger.logJob(job.id, 'CONTENT_GENERATION', 'QUEUED', { step: nextStep, contentId: data.contentId });
    return job;
  }

  async createPublishJob(data: PublishJobData, delay?: number) {
    const job = await this.prisma.job.create({
      data: {
        contentId: data.contentId,
        type: JobType.PUBLISH_LINKEDIN,
        status: JobStatus.PENDING,
        payload: data as any,
      },
    });

    await this.publishQueue.add(
      'publish',
      { ...data, jobId: job.id },
      {
        jobId: job.id,
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.logJob(job.id, 'PUBLISH', 'QUEUED', {
      contentId: data.contentId,
      delay,
    });
    return job;
  }

  async createAnalyticsJob(data: AnalyticsJobData) {
    const job = await this.prisma.job.create({
      data: {
        contentId: data.contentId,
        type: JobType.FETCH_ANALYTICS,
        status: JobStatus.PENDING,
        payload: data as any,
      },
    });

    await this.analyticsQueue.add(
      'fetch',
      { ...data, jobId: job.id },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return job;
  }

  async updateJobStatus(jobId: string, status: JobStatus, result?: any, error?: string) {
    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        result: result as any,
        error,
        processedAt: status === JobStatus.PROCESSING ? new Date() : undefined,
        completedAt: status === JobStatus.COMPLETED ? new Date() : undefined,
        attempts: { increment: status === JobStatus.RETRYING ? 1 : 0 },
      },
    });
  }

  async getJobsByContent(contentId: string) {
    return this.prisma.job.findMany({
      where: { contentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQueueStats() {
    const [contentQueue, publishQueue, analyticsQueue] = await Promise.all([
      this.getQueueInfo(this.contentQueue),
      this.getQueueInfo(this.publishQueue),
      this.getQueueInfo(this.analyticsQueue),
    ]);

    return {
      contentGeneration: contentQueue,
      publish: publishQueue,
      analytics: analyticsQueue,
    };
  }

  private async getQueueInfo(queue: Queue) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
