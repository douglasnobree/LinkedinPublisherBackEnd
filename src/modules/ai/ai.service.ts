import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LoggerService } from '../../common/services/logger.service';
import { PromptService } from './prompt.service';
import { Persona } from '@prisma/client';

export interface GenerationResult {
  content: string;
  tokens: number;
  duration: number;
}

@Injectable()
export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: string = 'gemini-3-flash-preview'; // Free tier model

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
    private promptService: PromptService,
  ) {
    const apiKey = this.configService.get('AI_KEY');
    if (!apiKey) {
      throw new Error('AI_KEY is required in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Step 1: Generate outline from theme
   */
  async generateOutline(theme: string, persona: Persona): Promise<GenerationResult> {
    const startTime = Date.now();
    
    const prompt = this.promptService.getOutlinePrompt(theme, persona);
    const fullPrompt = `${prompt.system}\n\n${prompt.user}`;
    
    const model = this.genAI.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    const duration = Date.now() - startTime;
    const tokens = response.usageMetadata?.totalTokenCount || 0;

    this.logger.logOpenAI('generateOutline', tokens, duration);

    return {
      content: text,
      tokens,
      duration,
    };
  }

  /**
   * Step 2: Generate post content from outline
   */
  async generatePost(outline: string, theme: string, persona: Persona): Promise<GenerationResult> {
    const startTime = Date.now();
    
    const prompt = this.promptService.getPostPrompt(outline, theme, persona);
    const fullPrompt = `${prompt.system}\n\n${prompt.user}`;
    
    const model = this.genAI.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2000,
      },
    });

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    const duration = Date.now() - startTime;
    const tokens = response.usageMetadata?.totalTokenCount || 0;

    this.logger.logOpenAI('generatePost', tokens, duration);

    return {
      content: text,
      tokens,
      duration,
    };
  }

  /**
   * Step 3: Polish content for LinkedIn tone
   */
  async polishForLinkedIn(content: string, persona: Persona): Promise<GenerationResult> {
    const startTime = Date.now();
    
    const prompt = this.promptService.getPolishPrompt(content, persona);
    const fullPrompt = `${prompt.system}\n\n${prompt.user}`;
    
    const model = this.genAI.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2000,
      },
    });

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    const duration = Date.now() - startTime;
    const tokens = response.usageMetadata?.totalTokenCount || 0;

    this.logger.logOpenAI('polishForLinkedIn', tokens, duration);

    return {
      content: text,
      tokens,
      duration,
    };
  }

  /**
   * Generate A/B variants
   */
  async generateVariants(content: string, count: number = 2): Promise<GenerationResult[]> {
    const variants: GenerationResult[] = [];

    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      
      const systemPrompt = `You are a LinkedIn content expert. Create a unique variation of the provided content. 
Keep the core message but change the hook, structure, or angle.
This is variant ${i + 1} of ${count}, make it distinct from others.`;

      const userPrompt = `Create a variation of this LinkedIn post:\n\n${content}`;
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 2000,
        },
      });

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      const duration = Date.now() - startTime;
      const tokens = response.usageMetadata?.totalTokenCount || 0;

      variants.push({
        content: text,
        tokens,
        duration,
      });
    }

    return variants;
  }

  /**
   * Generate auto-comment for first reply
   */
  async generateAutoComment(postContent: string): Promise<GenerationResult> {
    const startTime = Date.now();
    
    const systemPrompt = `You are a LinkedIn engagement expert. Create a compelling first comment for the author to post on their own content.
This comment should:
- Add value to the post
- Encourage discussion
- Ask a thought-provoking question
- Be authentic and conversational
Keep it under 200 characters.`;

    const userPrompt = `Create a first comment for this post:\n\n${postContent}`;
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const model = this.genAI.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 300,
      },
    });

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    const duration = Date.now() - startTime;
    const tokens = response.usageMetadata?.totalTokenCount || 0;

    this.logger.logOpenAI('generateAutoComment', tokens, duration);

    return {
      content: text,
      tokens,
      duration,
    };
  }
}
