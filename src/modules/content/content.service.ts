import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoggerService } from '../../common/services/logger.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ContentStatus, Persona } from '@prisma/client';

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {}

  async create(userId: string, dto: CreateContentDto) {
    const content = await this.prisma.content.create({
      data: {
        userId,
        theme: dto.theme,
        persona: dto.persona || Persona.GENERAL,
        status: ContentStatus.DRAFT,
        metadata: dto.metadata,
      },
    });

    this.logger.log(`Content created: ${content.id}`, 'ContentService');
    return content;
  }

  async findAll(userId: string, options: {
    status?: ContentStatus;
    persona?: Persona;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, persona, page = 1, limit = 10 } = options;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where = {
      userId,
      ...(status && { status }),
      ...(persona && { persona }),
    };

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip: skip || 0,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          schedule: true,
          analytics: true,
        },
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findOne(id: string, userId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        schedule: true,
        analytics: true,
        abTests: true,
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (content.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return content;
  }

  async update(id: string, userId: string, dto: UpdateContentDto) {
    const content = await this.findOne(id, userId);

    const updated = await this.prisma.content.update({
      where: { id },
      data: {
        ...dto,
        version: content.version + 1,
      },
    });

    this.logger.log(`Content updated: ${id}`, 'ContentService');
    return updated;
  }

  async updateStatus(id: string, status: ContentStatus) {
    return this.prisma.content.update({
      where: { id },
      data: { status },
    });
  }

  async updateContent(id: string, data: {
    outline?: string;
    rawContent?: string;
    finalContent?: string;
  }) {
    return this.prisma.content.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId);

    await this.prisma.content.delete({ where: { id } });

    this.logger.log(`Content deleted: ${id}`, 'ContentService');
    return { success: true };
  }

  async getDashboardStats(userId: string) {
    const [
      totalContents,
      publishedContents,
      scheduledContents,
      draftContents,
    ] = await Promise.all([
      this.prisma.content.count({ where: { userId } }),
      this.prisma.content.count({ where: { userId, status: ContentStatus.PUBLISHED } }),
      this.prisma.content.count({ where: { userId, status: ContentStatus.SCHEDULED } }),
      this.prisma.content.count({ where: { userId, status: ContentStatus.DRAFT } }),
    ]);

    const recentContents = await this.prisma.content.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        schedule: true,
        analytics: {
          select: {
            impressions: true,
            likes: true,
            comments: true,
            engagement: true,
          },
        },
      },
    });

    return {
      stats: {
        total: totalContents,
        published: publishedContents,
        scheduled: scheduledContents,
        draft: draftContents,
      },
      recentContents,
    };
  }
}
