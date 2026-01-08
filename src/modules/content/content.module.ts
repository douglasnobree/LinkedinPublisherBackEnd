import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentImageController } from './content-image.controller';
import { ContentUploadController } from './content-upload.controller';
import { ContentService } from './content.service';

@Module({
  controllers: [ContentController, ContentImageController, ContentUploadController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
