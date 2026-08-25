import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ProjStatus } from '../../../domain/proj.entity';

/**
 * Creation payload for PROJ (PROJ).
 *
 * The global ValidationPipe runs with `whitelist` and `forbidNonWhitelisted`,
 * so any property not declared here is rejected with 400 before the
 * controller is reached. Extend this DTO as the API contract grows.
 */
export class CreateProjDto {
  @ApiProperty({ description: 'Human readable name of the proj record.', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  readonly name!: string;

  @ApiPropertyOptional({ description: 'Free-form description.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly description?: string;

  @ApiPropertyOptional({ enum: ProjStatus, default: ProjStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProjStatus)
  readonly status?: ProjStatus;
}
