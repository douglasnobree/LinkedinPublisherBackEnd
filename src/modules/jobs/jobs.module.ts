import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { ContentGenerationProcessor } from './processors/content-generation.processor';
import { PublishProcessor } from './processors/publish.processor';
import { AnalyticsProcessor } from './processors/analytics.processor';
import { AIModule } from '../ai/ai.module';
import { LinkedInModule } from '../linkedin/linkedin.module';
import { ContentModule } from '../content/content.module';
import { QUEUES } from './queues.constants';

export { QUEUES };

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.CONTENT_GENERATION },
      { name: QUEUES.PUBLISH },
      { name: QUEUES.ANALYTICS },
    ),
    AIModule,
    LinkedInModule,
    forwardRef(() => ContentModule),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    ContentGenerationProcessor,
    PublishProcessor,
    AnalyticsProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}
