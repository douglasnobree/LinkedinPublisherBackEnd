import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LoggerService } from '../../common/services/logger.service';

export interface ImageGenerationOptions {
  model?: string;
  quality?: 'low' | 'medium' | 'high' | 'hd' | 'standard';
}

export interface ImageGenerationResult {
  imageUrl: string;
  prompt: string;
  model: string;
}

@Injectable()
export class ImageService {
  private readonly puterApiUrl = 'https://api.puter.com/v2';
  private readonly defaultModel = 'gemini-2.5-flash-image-preview';

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {}

  /**
   * Generate image from text prompt using Puter.ai
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {},
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    try {
      // Puter.ai API endpoint for image generation
      // Note: This is a placeholder - you may need to adjust based on actual Puter.ai API
      const response = await axios.post(
        `${this.puterApiUrl}/ai/txt2img`,
        {
          prompt,
          model,
          quality: options.quality || 'medium',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 seconds timeout for image generation
        },
      );

      const imageUrl = response.data.imageUrl || response.data.url || response.data.image;

      if (!imageUrl) {
        throw new Error('No image URL returned from Puter.ai');
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Image generated: ${prompt.substring(0, 50)}...`, 'ImageService');

      return {
        imageUrl,
        prompt,
        model,
      };
    } catch (error: any) {
      this.logger.error(
        `Image generation failed: ${error.message}`,
        error.stack,
        'ImageService',
      );
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  /**
   * Generate image prompt from content theme
   */
  generateImagePrompt(theme: string, persona: string): string {
    const personaPrompts: Record<string, string> = {
      TECH: 'professional tech illustration, modern, clean, tech-focused',
      FOUNDER: 'business illustration, entrepreneurial, inspiring, professional',
      RECRUITER: 'workplace illustration, diverse team, professional, welcoming',
      GENERAL: 'professional illustration, modern, clean, engaging',
    };

    const style = personaPrompts[persona] || personaPrompts.GENERAL;

    return `${theme}. ${style}, high quality, LinkedIn post image, professional, minimalist design`;
  }

  /**
   * Generate image for LinkedIn post
   */
  async generatePostImage(
    theme: string,
    persona: string,
    options?: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    const prompt = this.generateImagePrompt(theme, persona);
    return this.generateImage(prompt, options);
  }
}
