import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { PromptService } from './prompt.service';

@Module({
  providers: [AIService, PromptService],
  exports: [AIService, PromptService],
})
export class AIModule {}
