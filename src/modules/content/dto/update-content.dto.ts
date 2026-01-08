import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Persona, ContentStatus } from '@prisma/client';

export class UpdateContentDto {
  @ApiPropertyOptional({ description: 'Theme/topic for content generation' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  theme?: string;

  @ApiPropertyOptional({ description: 'Content outline' })
  @IsOptional()
  @IsString()
  outline?: string;

  @ApiPropertyOptional({ description: 'Raw generated content' })
  @IsOptional()
  @IsString()
  rawContent?: string;

  @ApiPropertyOptional({ description: 'Final polished content' })
  @IsOptional()
  @IsString()
  finalContent?: string;

  @ApiPropertyOptional({ enum: Persona })
  @IsOptional()
  @IsEnum(Persona)
  persona?: Persona;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
