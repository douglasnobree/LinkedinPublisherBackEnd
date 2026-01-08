import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Persona } from '@prisma/client';

interface PromptPair {
  system: string;
  user: string;
}

const PERSONA_DESCRIPTIONS: Record<Persona, string> = {
  GENERAL: 'a professional with diverse interests sharing valuable insights',
  TECH: 'a tech leader passionate about technology, coding, and innovation',
  FOUNDER: 'a startup founder sharing entrepreneurship lessons and business insights',
  RECRUITER: 'a talent acquisition specialist focused on careers, hiring, and workplace culture',
};

const PERSONA_TONES: Record<Persona, string> = {
  GENERAL: 'professional yet approachable, balanced between formal and casual',
  TECH: 'technical but accessible, enthusiastic about innovation, includes relevant tech references',
  FOUNDER: 'inspiring and candid, shares lessons learned, authentic about challenges',
  RECRUITER: 'encouraging and supportive, career-focused, inclusive language',
};

@Injectable()
export class PromptService {
  constructor(private prisma: PrismaService) {}

  getOutlinePrompt(theme: string, persona: Persona): PromptPair {
    const personaDesc = PERSONA_DESCRIPTIONS[persona];
    
    return {
      system: `You are ${personaDesc}. You're planning a LinkedIn post about "${theme}".
      
Create a structured outline with:
1. Hook (attention-grabbing first line)
2. Main points (3-5 key insights)
3. Story/Example (personal touch)
4. Key takeaway
5. Call-to-action

Keep it focused and value-driven. The outline should guide content creation.`,
      user: `Create an outline for a LinkedIn post about: ${theme}`,
    };
  }

  getPostPrompt(outline: string, theme: string, persona: Persona): PromptPair {
    const personaDesc = PERSONA_DESCRIPTIONS[persona];
    const tone = PERSONA_TONES[persona];
    
    return {
      system: `You are ${personaDesc}. Write a compelling LinkedIn post based on the provided outline.

Guidelines:
- Tone: ${tone}
- Length: 150-300 words (optimal for LinkedIn engagement)
- Use short paragraphs and line breaks for readability
- Include relevant emojis sparingly (2-4 max)
- End with engagement prompt or question
- No hashtags in the main content (added separately)

Writing style:
- Start with a strong hook (first line is crucial)
- Use "I" statements for authenticity
- Include specific examples or data points
- Create emotional connection
- Be conversational, not corporate`,
      user: `Theme: ${theme}

Outline:
${outline}

Write the LinkedIn post:`,
    };
  }

  getPolishPrompt(content: string, persona: Persona): PromptPair {
    const tone = PERSONA_TONES[persona];
    
    return {
      system: `You are a LinkedIn content optimization expert. Polish the provided content for maximum engagement.

Optimize for:
- LinkedIn's algorithm (line breaks, engagement prompts)
- Mobile readability (short lines, clear spacing)
- Professional tone: ${tone}
- Hook strength (first line appears in preview)
- Clear value proposition

Rules:
- Keep the core message intact
- Improve flow and readability
- Ensure proper formatting
- Add 3-5 relevant hashtags at the end
- Maximum 3000 characters`,
      user: `Polish this LinkedIn post:

${content}`,
    };
  }

  // Load custom prompts from database
  async getCustomPrompt(name: string): Promise<string | null> {
    const template = await this.prisma.promptTemplate.findFirst({
      where: { name, isActive: true },
      orderBy: { version: 'desc' },
    });
    
    return template?.template || null;
  }

  // Save new prompt version
  async savePromptVersion(name: string, template: string, description?: string) {
    const existing = await this.prisma.promptTemplate.findFirst({
      where: { name },
      orderBy: { version: 'desc' },
    });

    return this.prisma.promptTemplate.create({
      data: {
        name,
        template,
        description,
        version: (existing?.version || 0) + 1,
        variables: this.extractVariables(template),
      },
    });
  }

  private extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  }
}
