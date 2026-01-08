import { Controller, Post, Body, UseGuards, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('content')
@Controller('content')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentImageController {
  constructor(private contentService: ContentService) {}

  @Post(':id/image')
  @ApiOperation({ summary: 'Save generated image URL for content' })
  async saveImage(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { imageUrl: string; imagePrompt?: string },
  ) {
    return this.contentService.update(id, user.id, {
      imageUrl: body.imageUrl,
      imagePrompt: body.imagePrompt,
    });
  }
}
