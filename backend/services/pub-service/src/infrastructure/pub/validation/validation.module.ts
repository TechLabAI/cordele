import { Global, Module } from '@nestjs/common';

import { EpubValidationPort } from '../../../modules/pub/ports/epub-validation.port';
import { EpubcheckValidationAdapter } from './epubcheck-validation.adapter';

/**
 * ValidationModule — registers the epubcheck adapter for `EpubValidationPort`
 * (PUB-010, P4).
 *
 * Decorated `@Global()` so `PubModule`'s use cases receive the token from the
 * global scope without importing infrastructure/ directly (RULE-04 / RULE-05).
 *
 * `ConfigService` is available globally from `ConfigModule.forRoot({isGlobal:
 * true})` in `AppModule` — no explicit import needed here.
 */
@Global()
@Module({
  providers: [
    EpubcheckValidationAdapter,
    {
      provide: EpubValidationPort,
      useExisting: EpubcheckValidationAdapter,
    },
  ],
  exports: [EpubValidationPort],
})
export class ValidationModule {}
