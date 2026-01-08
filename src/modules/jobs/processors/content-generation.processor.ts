import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, forwardRef } from '@nestjs/common';
import { QUEUES } from '../queues.constants';
import { JobsService, ContentGenerationJobData } from '../jobs.service';
import { AIService } from '../../ai/ai.service';
import { ContentService } from '../../content/content.service';
import { LoggerService } from '../../../common/services/logger.service';
import { JobStatus, ContentStatus } from '@prisma/client';

@Processor(QUEUES.CONTENT_GENERATION)
export class ContentGenerationProcessor extends WorkerHost {
  constructor(
    private jobsService: JobsService,
    private aiService: AIService,
    @Inject(forwardRef(() => ContentService))
    private contentService: ContentService,
    private logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job<ContentGenerationJobData & { jobId: string }>): Promise<any> {
    const { contentId, userId, theme, persona, step, jobId } = job.data;

    this.logger.logJob(jobId, 'CONTENT_GENERATION', 'PROCESSING', { step });

    try {
      await this.jobsService.updateJobStatus(jobId, JobStatus.PROCESSING);
      await this.contentService.updateStatus(contentId, ContentStatus.GENERATING);

      let result: any;

      switch (step) {
        case 'outline': {
          const outline = await this.aiService.generateOutline(theme, persona);
          await this.contentService.updateContent(contentId, { outline: outline.content });
          
          result = outline;
          await this.jobsService.updateJobStatus(jobId, JobStatus.COMPLETED, result);
          this.logger.logJob(jobId, 'CONTENT_GENERATION', 'COMPLETED', { step: 'outline' });
          
          // Create next step job
          await this.jobsService.createNextStepJob(
            { contentId, userId, theme, persona, step: 'post' },
            'post'
          );
          break;
        }

        case 'post': {
          const content = await this.contentService.findOne(contentId, userId);
          if (!content.outline) throw new Error('Outline not found');
          
          const post = await this.aiService.generatePost(content.outline, theme, persona);
          await this.contentService.updateContent(contentId, { rawContent: post.content });
          
          result = post;
          await this.jobsService.updateJobStatus(jobId, JobStatus.COMPLETED, result);
          this.logger.logJob(jobId, 'CONTENT_GENERATION', 'COMPLETED', { step: 'post' });
          
          // Create next step job
          await this.jobsService.createNextStepJob(
            { contentId, userId, theme, persona, step: 'polish' },
            'polish'
          );
          break;
        }

        case 'polish': {
          const content = await this.contentService.findOne(contentId, userId);
          if (!content.rawContent) throw new Error('Raw content not found');
          
          const polished = await this.aiService.polishForLinkedIn(content.rawContent, persona);
          await this.contentService.updateContent(contentId, { finalContent: polished.content });
          await this.contentService.updateStatus(contentId, ContentStatus.REVIEW);
          
          result = polished;
          await this.jobsService.updateJobStatus(jobId, JobStatus.COMPLETED, result);
          this.logger.logJob(jobId, 'CONTENT_GENERATION', 'COMPLETED', { step: 'polish' });
          break;
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Content generation failed: ${error.message}`, error.stack, 'ContentGenerationProcessor');
      
      await this.jobsService.updateJobStatus(jobId, JobStatus.FAILED, null, error.message);
      await this.contentService.updateStatus(contentId, ContentStatus.FAILED);
      
      throw error;
    }
  }
}
