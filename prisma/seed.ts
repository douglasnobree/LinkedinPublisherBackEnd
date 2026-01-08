import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default prompt templates
  const promptTemplates = [
    {
      name: 'outline_tech',
      description: 'Outline prompt for tech persona',
      template: `Create a structured outline for a LinkedIn post about {{theme}}.
      
Target audience: Tech professionals, developers, CTOs
Tone: Technical but accessible, enthusiastic about innovation

Include:
1. Hook (attention-grabbing first line)
2. Main points (3-5 key insights)
3. Code/Tech example if relevant
4. Key takeaway
5. Call-to-action

Keep it focused and value-driven.`,
      variables: ['theme'],
    },
    {
      name: 'outline_founder',
      description: 'Outline prompt for founder persona',
      template: `Create a structured outline for a LinkedIn post about {{theme}}.
      
Target audience: Entrepreneurs, startup founders, business leaders
Tone: Inspiring, candid, authentic about challenges

Include:
1. Hook (personal story or surprising insight)
2. Main points (lessons learned, frameworks)
3. Real example from entrepreneurship
4. Key takeaway
5. Engagement question

Be authentic and share real lessons.`,
      variables: ['theme'],
    },
    {
      name: 'polish_linkedin',
      description: 'Polish content for LinkedIn algorithm',
      template: `Polish this LinkedIn post for maximum engagement:

{{content}}

Optimize for:
- LinkedIn algorithm (line breaks every 2-3 lines)
- Mobile readability (short sentences)
- Hook strength (first line is crucial)
- Clear value proposition
- Professional but conversational tone

Add 3-5 relevant hashtags at the end.
Maximum 3000 characters.`,
      variables: ['content'],
    },
  ];

  for (const template of promptTemplates) {
    await prisma.promptTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: template,
    });
  }

  // Create default feature flags
  const featureFlags = [
    {
      key: 'ab_testing',
      description: 'Enable A/B testing for posts',
      isEnabled: true,
    },
    {
      key: 'auto_comment',
      description: 'Enable automatic first comment',
      isEnabled: true,
    },
    {
      key: 'personas',
      description: 'Enable persona selection',
      isEnabled: true,
    },
    {
      key: 'analytics_v2',
      description: 'Use new analytics dashboard',
      isEnabled: false,
    },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag,
    });
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
