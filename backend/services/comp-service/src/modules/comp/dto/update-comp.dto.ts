import { PartialType } from '@nestjs/swagger';

import { CreateCompDto } from './create-comp.dto';

/**
 * Partial update payload for COMP.
 *
 * `PartialType` (from @nestjs/swagger, not @nestjs/mapped-types) keeps every
 * class-validator rule of the create DTO but marks each field optional, and
 * carries the OpenAPI metadata over to the generated document.
 */
export class UpdateCompDto extends PartialType(CreateCompDto) {}
