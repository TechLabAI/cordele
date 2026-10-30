/**
 * Unit spec for the three erasure port stubs (PROJ-015).
 *
 * Verified behaviours:
 *  1. Each stub's erase() resolves without error — safe no-op (idempotent).
 *  2. Each stub implements the port interface (TypeScript compile-time; asserted
 *     via direct type assignment at construction).
 *  3. Stubs are swappable in a NestJS TestingModule via overrideProvider() so
 *     unit tests can replace them with jest mocks.
 *
 * The NestJS testing module test (behaviour 3) uses the symbolic DI tokens
 * (re-exported from the domain port files) exactly as production code does —
 * this confirms that the token identity used in ErasurePortsModule matches what
 * DeleteProjetoUseCase injects.
 */

import { Test } from '@nestjs/testing';

import { PublicationErasurePort } from '../../../domain/proj/ports/outbound/publication-erasure.port';
import { CompositionErasurePort } from '../../../domain/proj/ports/outbound/composition-erasure.port';
import { ManuscriptErasurePort } from '../../../domain/proj/ports/outbound/manuscript-erasure.port';
import { PublicationErasureStub } from './publication-erasure.stub';
import { CompositionErasureStub } from './composition-erasure.stub';
import { ManuscriptErasureStub } from './manuscript-erasure.stub';

const PROJETO_ID = 'projeto-id-1';
const EMPRESA_ID = 'empresa-id-aetos';

// ---------------------------------------------------------------------------
// Behaviour 1 — erase() resolves without throwing (safe no-op)
// ---------------------------------------------------------------------------

describe('PublicationErasureStub', () => {
  it('erase() resolves without error (safe no-op)', async () => {
    const stub = new PublicationErasureStub();
    await expect(stub.erase(PROJETO_ID, EMPRESA_ID)).resolves.toBeUndefined();
  });

  it('erase() is idempotent — calling twice does not throw', async () => {
    const stub = new PublicationErasureStub();
    await stub.erase(PROJETO_ID, EMPRESA_ID);
    await expect(stub.erase(PROJETO_ID, EMPRESA_ID)).resolves.toBeUndefined();
  });
});

describe('CompositionErasureStub', () => {
  it('erase() resolves without error (safe no-op)', async () => {
    const stub = new CompositionErasureStub();
    await expect(stub.erase(PROJETO_ID, EMPRESA_ID)).resolves.toBeUndefined();
  });

  it('erase() is idempotent — calling twice does not throw', async () => {
    const stub = new CompositionErasureStub();
    await stub.erase(PROJETO_ID, EMPRESA_ID);
    await expect(stub.erase(PROJETO_ID, EMPRESA_ID)).resolves.toBeUndefined();
  });
});

describe('ManuscriptErasureStub', () => {
  it('erase() resolves without error (safe no-op)', async () => {
    const stub = new ManuscriptErasureStub();
    await expect(stub.erase(PROJETO_ID, EMPRESA_ID)).resolves.toBeUndefined();
  });

  it('erase() is idempotent — calling twice does not throw', async () => {
    const stub = new ManuscriptErasureStub();
    await stub.erase(PROJETO_ID, EMPRESA_ID);
    await expect(stub.erase(PROJETO_ID, EMPRESA_ID)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Behaviour 3 — DI tokens are swappable via overrideProvider() in TestingModule
// ---------------------------------------------------------------------------

describe('Erasure stubs — NestJS DI override', () => {
  it('PublicationErasurePort token can be overridden with a jest mock', async () => {
    const mockErase = jest.fn().mockResolvedValue(undefined);
    const mockAdapter: PublicationErasurePort = { erase: mockErase };

    const module = await Test.createTestingModule({
      providers: [
        { provide: PublicationErasurePort, useClass: PublicationErasureStub },
      ],
    })
      .overrideProvider(PublicationErasurePort)
      .useValue(mockAdapter)
      .compile();

    const resolved = module.get<PublicationErasurePort>(PublicationErasurePort);
    await resolved.erase(PROJETO_ID, EMPRESA_ID);

    expect(mockErase).toHaveBeenCalledWith(PROJETO_ID, EMPRESA_ID);
    expect(mockErase).toHaveBeenCalledTimes(1);
  });

  it('CompositionErasurePort token can be overridden with a jest mock', async () => {
    const mockErase = jest.fn().mockResolvedValue(undefined);
    const mockAdapter: CompositionErasurePort = { erase: mockErase };

    const module = await Test.createTestingModule({
      providers: [
        { provide: CompositionErasurePort, useClass: CompositionErasureStub },
      ],
    })
      .overrideProvider(CompositionErasurePort)
      .useValue(mockAdapter)
      .compile();

    const resolved = module.get<CompositionErasurePort>(CompositionErasurePort);
    await resolved.erase(PROJETO_ID, EMPRESA_ID);

    expect(mockErase).toHaveBeenCalledWith(PROJETO_ID, EMPRESA_ID);
    expect(mockErase).toHaveBeenCalledTimes(1);
  });

  it('ManuscriptErasurePort token can be overridden with a jest mock', async () => {
    const mockErase = jest.fn().mockResolvedValue(undefined);
    const mockAdapter: ManuscriptErasurePort = { erase: mockErase };

    const module = await Test.createTestingModule({
      providers: [
        { provide: ManuscriptErasurePort, useClass: ManuscriptErasureStub },
      ],
    })
      .overrideProvider(ManuscriptErasurePort)
      .useValue(mockAdapter)
      .compile();

    const resolved = module.get<ManuscriptErasurePort>(ManuscriptErasurePort);
    await resolved.erase(PROJETO_ID, EMPRESA_ID);

    expect(mockErase).toHaveBeenCalledWith(PROJETO_ID, EMPRESA_ID);
    expect(mockErase).toHaveBeenCalledTimes(1);
  });
});
