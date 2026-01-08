import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ContentStatus, Persona } from '@prisma/client';

@ApiTags('content')
@Controller('content')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentController {
  constructor(private contentService: ContentService) {}

  @Post()
  @ApiOperation({ summary: 'Create new content' })
  create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateContentDto,
  ) {
    return this.contentService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all content' })
  @ApiQuery({ name: 'status', required: false, enum: ContentStatus })
  @ApiQuery({ name: 'persona', required: false, enum: Persona })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: ContentStatus,
    @Query('persona') persona?: Persona,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.contentService.findAll(user.id, { status, persona, page, limit });
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboard(@CurrentUser() user: CurrentUserData) {
    return this.contentService.getDashboardStats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get content by ID' })
  findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contentService.findOne(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update content' })
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentDto,
  ) {
    return this.contentService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete content' })
  delete(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contentService.delete(id, user.id);
  }
}
