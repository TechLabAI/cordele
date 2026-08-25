import { PartialType } from '@nestjs/swagger';

import { CreatePubDto } from './create-pub.dto';

/**
 * Partial update payload for PUB.
 *
 * `PartialType` (from @nestjs/swagger, not @nestjs/mapped-types) keeps every
 * class-validator rule of the create DTO but marks each field optional, and
 * carries the OpenAPI metadata over to the generated document.
 */
export class UpdatePubDto extends PartialType(CreatePubDto) {}
