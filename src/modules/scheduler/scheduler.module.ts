import { Module, forwardRef } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { SchedulerTask } from './scheduler.task';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [forwardRef(() => JobsModule)],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerTask],
  exports: [SchedulerService],
})
export class SchedulerModule {}
