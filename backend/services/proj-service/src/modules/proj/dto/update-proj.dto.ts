import { PartialType } from '@nestjs/swagger';

import { CreateProjDto } from './create-proj.dto';

/**
 * Partial update payload for PROJ.
 *
 * `PartialType` (from @nestjs/swagger, not @nestjs/mapped-types) keeps every
 * class-validator rule of the create DTO but marks each field optional, and
 * carries the OpenAPI metadata over to the generated document.
 */
export class UpdateProjDto extends PartialType(CreateProjDto) {}
