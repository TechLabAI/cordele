import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjetoCardDto } from './projeto-card.dto';

/**
 * Paginated response envelope for the project library endpoint (T02).
 *
 * The envelope is preferred over a flat array + header for cursor pagination
 * because `nextCursor` is a first-class part of the read contract — it is not
 * an accessory signal like `X-Degraded` (boolean, orthogonal to the response
 * shape). Embedding the cursor in the body:
 *  - Makes the contract self-documenting in OpenAPI/Swagger.
 *  - Lets typed clients (generated from OpenAPI) access the cursor without
 *    inspecting HTTP headers.
 *  - Follows the convention used by IMP, COMP and PUB batch endpoints.
 *
 * The FE `projeto-api.service.ts` must be updated to parse the envelope
 * (previously it expected a raw ProjetoCard[] array).
 */
export class ProjetoLibraryPageDto {
  @ApiProperty({
    type: [ProjetoCardDto],
    description: 'Project cards for this page, ordered by ultimaAtividadeEm DESC, id ASC.',
  })
  readonly items!: ProjetoCardDto[];

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Opaque cursor to pass as ?cursor= on the next request to retrieve the following page. ' +
      'Null when this is the last (or only) page. ' +
      'Treat as opaque — the encoding may change between service versions.',
    example: 'eyJhdHVhbGl6YWRvRW0iOiIyMDI2LTA5LTAxVDEyOjAwOjAwWiIsImlkIjoiYWJjZC0uLi4ifQ==',
  })
  readonly nextCursor!: string | null;
}
