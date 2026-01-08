import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';

// Common
import { PrismaModule } from './common/prisma/prisma.module';
import { LoggerModule } from './common/services/logger.module';
import { RedisModule } from './common/redis/redis.module';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { AIModule } from './modules/ai/ai.module';
import { LinkedInModule } from './modules/linkedin/linkedin.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('RATE_LIMIT_TTL', 60) * 1000,
            limit: config.get('RATE_LIMIT_MAX', 100),
          },
        ],
      }),
    }),

    // Task Scheduling
    ScheduleModule.forRoot(),

    // BullMQ Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      }),
    }),

    // Common Modules
    PrismaModule,
    LoggerModule,
    RedisModule,

    // Feature Modules
    AuthModule,
    ContentModule,
    AIModule,
    LinkedInModule,
    JobsModule,
    AnalyticsModule,
    SchedulerModule,
    HealthModule,
  ],
})
export class AppModule {}
