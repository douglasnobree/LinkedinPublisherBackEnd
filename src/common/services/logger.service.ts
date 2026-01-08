import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    this.logger = winston.createLogger({
      level: isDevelopment ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        isDevelopment
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                const ctx = context ? `[${context}]` : '';
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                return `${timestamp} ${level} ${ctx} ${message} ${metaStr}`;
              }),
            )
          : winston.format.json(),
      ),
      transports: [
        new winston.transports.Console(),
        ...(isDevelopment
          ? []
          : [
              new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
              new winston.transports.File({ filename: 'logs/combined.log' }),
            ]),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // Custom methods for structured logging
  logJob(jobId: string, jobType: string, status: string, meta?: Record<string, any>) {
    this.logger.info('Job execution', {
      context: 'JobProcessor',
      jobId,
      jobType,
      status,
      ...meta,
    });
  }

  logApiCall(method: string, path: string, statusCode: number, duration: number) {
    this.logger.info('API call', {
      context: 'HTTP',
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
    });
  }

  logLinkedInApi(action: string, success: boolean, meta?: Record<string, any>) {
    this.logger.info('LinkedIn API', {
      context: 'LinkedIn',
      action,
      success,
      ...meta,
    });
  }

  logOpenAI(action: string, tokens: number, duration: number) {
    this.logger.info('OpenAI API', {
      context: 'OpenAI',
      action,
      tokens,
      duration: `${duration}ms`,
    });
  }
}
