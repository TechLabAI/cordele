import { ApiProperty } from '@nestjs/swagger';

/**
 * Response envelope for the signed ePub download URL.
 *
 * Aligned with api-contract.md §4.5 / §6.5 (D-F). The client opens
 * `arquivoUrl` directly; PROJ never proxies the bytes. Only publications
 * whose epubcheckStatus is `valido` or `avisos` have a downloadable artifact.
 *
 * Controllers MUST return this DTO (never a Prisma model) at the HTTP boundary.
 */
export class SignedDownloadUrlDto {
  @ApiProperty({
    description: 'Publication identifier (UUID v4) this URL belongs to.',
    format: 'uuid',
  })
  readonly publicacaoId!: string;

  @ApiProperty({
    description: 'Short-TTL signed URL to the ePub artifact in object storage.',
    example: 'https://storage.example.com/romance-v2.epub?sig=...',
  })
  readonly arquivoUrl!: string;

  @ApiProperty({
    description: 'URL expiry timestamp (ISO-8601 UTC).',
    format: 'date-time',
    example: '2026-08-25T15:10:00Z',
  })
  readonly expiresAt!: string;
}
