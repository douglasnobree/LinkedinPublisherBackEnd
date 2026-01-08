import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as session from 'express-session';
import * as passport from 'passport';
import { json, urlencoded } from 'express';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { LoggerService } from './common/services/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);

  app.useLogger(logger);

  // Increase body size limit for image uploads (50MB)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Security
  const frontendUrl = configService.get('FRONTEND_URL', 'http://localhost:3000');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', frontendUrl, 'http://localhost:3001', 'https:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          connectSrc: ["'self'", frontendUrl, 'http://localhost:3001', 'https:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // Session for OAuth
  app.use(
    session({
      secret: configService.get('JWT_SECRET', 'session-secret'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 60000 * 15, // 15 minutes
        secure: configService.get('NODE_ENV') === 'production',
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // API Versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Serve static files (uploaded images) with CORS
  app.use(
    '/uploads',
    express.static(join(process.cwd(), 'uploads'), {
      setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', frontendUrl);
        res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Cache-Control', 'public, max-age=31536000');
      },
    }),
  );

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LinkedIn Content Generator API')
    .setDescription('API for AI-powered LinkedIn content generation and publishing')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('content', 'Content management')
    .addTag('linkedin', 'LinkedIn integration')
    .addTag('analytics', 'Analytics and metrics')
    .addTag('jobs', 'Background jobs')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get('BACKEND_PORT', 3001);
  await app.listen(port);

  logger.log(`🚀 Application running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
