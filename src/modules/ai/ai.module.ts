import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { PromptService } from './prompt.service';
import { ImageService } from './image.service';

@Module({
  providers: [AIService, PromptService, ImageService],
  exports: [AIService, PromptService, ImageService],
})
export class AIModule {}
