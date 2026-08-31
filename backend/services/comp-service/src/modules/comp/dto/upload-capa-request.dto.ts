import { ApiProperty } from '@nestjs/swagger';

/**
 * Payload descriptor for cover upload (api-contract §4.3, D-L).
 *
 * Actual validation (MIME type + size cap) is performed in the controller via
 * Multer interceptors in P4/P5. This class documents the expected multipart part
 * for Swagger and serves as the shape reference for the unit test.
 *
 * Constraints: image/jpeg | image/png | image/webp; ≤ 10 MB (10485760 bytes).
 */
export class UploadCapaRequestDto {
  @ApiProperty({
    description:
      'Cover image binary (multipart/form-data field "file"). ' +
      'Accepted types: image/jpeg, image/png, image/webp. Maximum size: 10 MB.',
    type: 'string',
    format: 'binary',
  })
  // File typed as unknown in P1; real Multer typing (Express.Multer.File) is
  // wired when the Multer interceptor is configured in P4 (COMP-015).
  readonly file!: unknown;
}
