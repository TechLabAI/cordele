import { Global, Module, type Provider } from '@nestjs/common';

import { EmpresaContextService } from '../auth/empresa-context.service';
import { CompCompositionLayoutAdapter } from '../http/comp-composition-layout.adapter';
import { CompCompositionMetadataAdapter } from '../http/comp-composition-metadata.adapter';
import { ImpManuscriptContentAdapter } from '../http/imp-manuscript-content.adapter';
import { ProjProjectStatusAdapter } from '../http/proj-project-status.adapter';
import {
  ADVANCE_PROJETO_STATUS_PORT,
  COMPOSITION_LAYOUT_PORT,
  COMPOSITION_METADATA_PORT,
  EMPRESA_CONTEXT_RUNNER_PORT,
  MANUSCRIPT_CONTENT_PORT,
} from '../../modules/pub/pub.tokens';

/**
 * When `PUB_USE_STUBS` is not `true`, bind the real HTTP adapters to the IMP
 * and PROJ port tokens, overriding the stub bindings `StubsModule` (@Global)
 * registers for those same tokens.
 *
 * The check runs at module-class definition time (before the DI container is
 * built), the idiomatic NestJS way to conditionally register providers.
 */
const useStubs = process.env['PUB_USE_STUBS'] === 'true' || process.env['NODE_ENV'] === 'test';

const httpAdapterProviders: Provider[] = useStubs
  ? []
  : [
      // INT-PUB-001: real HTTP adapter for ManuscriptContentPort (IMP service).
      { provide: MANUSCRIPT_CONTENT_PORT, useClass: ImpManuscriptContentAdapter },
      // INT-PUB-002: real HTTP adapters for CompositionMetadataPort and CompositionLayoutPort (COMP service).
      { provide: COMPOSITION_METADATA_PORT, useClass: CompCompositionMetadataAdapter },
      { provide: COMPOSITION_LAYOUT_PORT, useClass: CompCompositionLayoutAdapter },
      // INT-PUB-003: real HTTP adapter for AdvanceProjetoStatusPort (PROJ service).
      { provide: ADVANCE_PROJETO_STATUS_PORT, useClass: ProjProjectStatusAdapter },
    ];

/**
 * Global bindings for tokens consumed inside `PubModule` (a child module of
 * `AppModule`) that used to be registered as loose providers directly on
 * `AppModule.providers`.
 *
 * That placement does NOT work in NestJS: a parent module's own providers
 * are never visible to the child modules it imports — DI visibility only
 * flows the other way (child exports -> whoever imports the child). The
 * service crashed at boot with "Nest can't resolve dependencies...
 * Symbol(EmpresaContextRunnerPort)" because of this. Worse, the
 * `httpAdapterProviders` override (real IMP/PROJ HTTP adapters, used when
 * `PUB_USE_STUBS=false`) had the same placement bug — it wouldn't crash
 * (StubsModule's @Global stub binding for the same token remains in
 * effect), it would just SILENTLY use the wrong (stub) adapter in a
 * configuration that asked for the real one.
 *
 * None of the automated tests caught either bug: every test harness (e2e,
 * BDD) provides these tokens manually in its own `TestingModule`, without
 * ever instantiating the real `AppModule` tree — only booting the compiled
 * service (`node dist/main.js`) against a real Postgres surfaced this.
 *
 * Fix: same `@Global()` pattern already used by `PersistenceModule` /
 * `AuthModule` / `StubsModule` in this service — a `@Global()` module's
 * exports are visible everywhere in the module tree regardless of who
 * imports whom.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMPRESA_CONTEXT_RUNNER_PORT,
      useExisting: EmpresaContextService,
    },
    ...httpAdapterProviders,
  ],
  exports: useStubs
    ? [EMPRESA_CONTEXT_RUNNER_PORT]
    : [
        EMPRESA_CONTEXT_RUNNER_PORT,
        MANUSCRIPT_CONTENT_PORT,
        COMPOSITION_METADATA_PORT,
        COMPOSITION_LAYOUT_PORT,
        ADVANCE_PROJETO_STATUS_PORT,
      ],
})
export class PubInfraBindingsModule {}
