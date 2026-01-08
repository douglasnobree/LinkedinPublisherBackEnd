import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getUserAnalytics(userId: string) {
    const analytics = await this.prisma.analytics.findMany({
      where: { userId },
      include: {
        content: {
          select: {
            id: true,
            theme: true,
            persona: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals
    const totals = analytics.reduce(
      (acc, a) => ({
        impressions: acc.impressions + a.impressions,
        likes: acc.likes + a.likes,
        comments: acc.comments + a.comments,
        shares: acc.shares + a.shares,
        clicks: acc.clicks + a.clicks,
      }),
      { impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0 },
    );

    const avgEngagement =
      analytics.length > 0
        ? analytics.reduce((sum, a) => sum + a.engagement, 0) / analytics.length
        : 0;

    return {
      totals,
      avgEngagement,
      postsCount: analytics.length,
      posts: analytics,
    };
  }

  async getTopPerformingPosts(userId: string, limit = 10) {
    return this.prisma.analytics.findMany({
      where: { userId },
      orderBy: { engagement: 'desc' },
      take: limit,
      include: {
        content: {
          select: {
            id: true,
            theme: true,
            persona: true,
            finalContent: true,
          },
        },
      },
    });
  }

  async getAnalyticsByPeriod(userId: string, days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await this.prisma.analytics.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const grouped = analytics.reduce((acc: Record<string, any>, item) => {
      const date = item.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          posts: 0,
        };
      }
      acc[date].impressions += item.impressions;
      acc[date].likes += item.likes;
      acc[date].comments += item.comments;
      acc[date].shares += item.shares;
      acc[date].posts += 1;
      return acc;
    }, {});

    return Object.values(grouped);
  }

  async getPersonaPerformance(userId: string) {
    const results = await this.prisma.$queryRaw<
      Array<{
        persona: string;
        posts: bigint;
        avgEngagement: number;
        totalImpressions: bigint;
        totalLikes: bigint;
      }>
    >`
      SELECT 
        c.persona,
        COUNT(*) as posts,
        AVG(a.engagement) as "avgEngagement",
        SUM(a.impressions) as "totalImpressions",
        SUM(a.likes) as "totalLikes"
      FROM analytics a
      JOIN contents c ON a."contentId" = c.id
      WHERE a."userId" = ${userId}
      GROUP BY c.persona
    `;

    return results.map((r) => ({
      persona: r.persona,
      posts: Number(r.posts),
      avgEngagement: r.avgEngagement,
      totalImpressions: Number(r.totalImpressions),
      totalLikes: Number(r.totalLikes),
    }));
  }

  async getContentById(contentId: string, userId: string) {
    return this.prisma.analytics.findFirst({
      where: { contentId, userId },
      include: {
        content: true,
      },
    });
  }
}
