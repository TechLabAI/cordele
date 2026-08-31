import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One epubcheck report line returned by `GET .../validation-messages`
 * (api-contract §4.6, PUB-016).
 *
 * Shape aligned with `validation_message` schema (data-model.md §2.2) and
 * `ValidationMessageEntity`. Domain models are never returned from
 * controllers — this DTO is the only shape crossing the HTTP boundary.
 */
export class ValidationMessageItemDto {
  @ApiProperty({ description: 'Unique id of the validation message (UUID v4).', format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'epubcheck severity class.',
    enum: ['error', 'warning', 'info'],
  })
  severity!: string;

  @ApiProperty({ description: 'epubcheck message code (e.g. PKG-006, OPF-033).' })
  code!: string;

  @ApiProperty({ description: 'Human-readable epubcheck message text.' })
  message!: string;

  @ApiPropertyOptional({
    description: 'Location inside the ePub package where the issue was detected (nullable).',
    nullable: true,
  })
  location!: string | null;

  @ApiProperty({ description: 'Insertion order (0-based); rows are returned ordered by this field ASC.' })
  ordem!: number;
}
