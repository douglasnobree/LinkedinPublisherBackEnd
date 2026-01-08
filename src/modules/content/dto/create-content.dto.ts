import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Persona } from '@prisma/client';

export class CreateContentDto {
  @ApiProperty({ description: 'Theme/topic for content generation', example: 'AI in software development' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  theme: string;

  @ApiPropertyOptional({ enum: Persona, description: 'Content persona/tone' })
  @IsOptional()
  @IsEnum(Persona)
  persona?: Persona;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
