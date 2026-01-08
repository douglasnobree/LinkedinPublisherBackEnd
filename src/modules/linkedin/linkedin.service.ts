import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoggerService } from '../../common/services/logger.service';

export interface LinkedInPost {
  postId: string;
  url: string;
}

export interface LinkedInMetrics {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

@Injectable()
export class LinkedInService {
  private readonly apiUrl = 'https://api.linkedin.com/v2';
  private httpClient: AxiosInstance;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {
    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
    });
  }

  private async getAccessToken(userId: string): Promise<string> {
    const profile = await this.prisma.linkedinProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BadRequestException('LinkedIn profile not connected');
    }

    // Check if token is expired
    if (new Date() >= profile.tokenExpiresAt) {
      // TODO: Implement token refresh
      throw new BadRequestException('LinkedIn token expired. Please reconnect.');
    }

    return profile.accessToken;
  }

  async publishPost(userId: string, content: string): Promise<LinkedInPost> {
    const accessToken = await this.getAccessToken(userId);
    const profile = await this.prisma.linkedinProfile.findUnique({
      where: { userId },
    });

    try {
      // Get person URN
      const personUrn = `urn:li:person:${profile!.linkedinId}`;

      // Create post using UGC Post API
      const response = await this.httpClient.post(
        '/ugcPosts',
        {
          author: personUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: content,
              },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        },
      );

      const postId = response.headers['x-restli-id'] || response.data.id;
      const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

      this.logger.logLinkedInApi('publishPost', true, { postId });

      return {
        postId,
        url: postUrl,
      };
    } catch (error: any) {
      this.logger.logLinkedInApi('publishPost', false, {
        error: error.response?.data || error.message,
      });
      throw new BadRequestException(
        `Failed to publish to LinkedIn: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async postComment(userId: string, postId: string, comment: string): Promise<void> {
    const accessToken = await this.getAccessToken(userId);
    const profile = await this.prisma.linkedinProfile.findUnique({
      where: { userId },
    });

    try {
      await this.httpClient.post(
        '/socialActions/' + encodeURIComponent(postId) + '/comments',
        {
          actor: `urn:li:person:${profile!.linkedinId}`,
          message: {
            text: comment,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.logLinkedInApi('postComment', true, { postId });
    } catch (error: any) {
      this.logger.logLinkedInApi('postComment', false, {
        error: error.response?.data || error.message,
      });
      throw new BadRequestException(
        `Failed to post comment: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getPostMetrics(userId: string, postId: string): Promise<LinkedInMetrics> {
    const accessToken = await this.getAccessToken(userId);

    try {
      // Get social actions (likes, comments)
      const [likesRes, commentsRes, sharesRes] = await Promise.all([
        this.httpClient.get(`/socialActions/${encodeURIComponent(postId)}/likes`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { count: 0 },
        }),
        this.httpClient.get(`/socialActions/${encodeURIComponent(postId)}/comments`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { count: 0 },
        }),
        this.httpClient.get(`/shares/${encodeURIComponent(postId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => ({ data: { shares: 0 } })),
      ]);

      this.logger.logLinkedInApi('getPostMetrics', true, { postId });

      return {
        impressions: 0, // Requires Marketing API
        likes: likesRes.data.paging?.total || 0,
        comments: commentsRes.data.paging?.total || 0,
        shares: sharesRes.data.shares || 0,
        clicks: 0, // Requires Marketing API
      };
    } catch (error: any) {
      this.logger.logLinkedInApi('getPostMetrics', false, {
        error: error.response?.data || error.message,
      });
      throw new BadRequestException(
        `Failed to get metrics: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getProfile(userId: string) {
    const accessToken = await this.getAccessToken(userId);

    try {
      const response = await this.httpClient.get('/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return response.data;
    } catch (error: any) {
      this.logger.logLinkedInApi('getProfile', false, {
        error: error.response?.data || error.message,
      });
      throw new BadRequestException('Failed to get LinkedIn profile');
    }
  }
}
