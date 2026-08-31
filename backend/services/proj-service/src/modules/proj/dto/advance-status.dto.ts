import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';

/**
 * Payload for advancing the status of a ProjetoEditorial.
 *
 * Aligned with api-contract.md §4.8 (advance-status — called by PUB via HTTP).
 *
 * `targetStatus` must be a valid ProjetoStatus value. The VO (`ProjectStatusVO`)
 * further enforces that the transition from the current status is legal; illegal
 * transitions are surfaced as 409 by the controller's error mapping.
 */
export class AdvanceStatusDto {
  @ApiProperty({
    description: 'Target status for the forward transition.',
    enum: ProjetoStatus,
    example: ProjetoStatus.publicado,
  })
  @IsEnum(ProjetoStatus, {
    message: `targetStatus must be one of: ${Object.values(ProjetoStatus).join(', ')}`,
  })
  readonly targetStatus!: ProjetoStatus;
}
