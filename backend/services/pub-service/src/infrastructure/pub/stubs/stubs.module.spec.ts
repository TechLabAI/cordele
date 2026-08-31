import { Test } from '@nestjs/testing';

import { AdvanceProjetoStatusPort } from '../../../modules/pub/ports/advance-projeto-status.port';
import { CompositionLayoutPort } from '../../../modules/pub/ports/composition-layout.port';
import { CompositionMetadataPort } from '../../../modules/pub/ports/composition-metadata.port';
import { ManuscriptContentPort } from '../../../modules/pub/ports/manuscript-content.port';
import { StubsModule } from './stubs.module';

describe('StubsModule', () => {
  const buildModule = async () =>
    Test.createTestingModule({ imports: [StubsModule] }).compile();

  afterEach(() => {
    delete process.env['PUB_MANUSCRIPT_STUB_NULL'];
    delete process.env['PUB_METADADOS_STUB_NULL'];
  });

  it('module initializes and all four tokens are resolvable', async () => {
    const app = await buildModule();
    expect(app.get<ManuscriptContentPort>(ManuscriptContentPort as symbol)).toBeDefined();
    expect(app.get<CompositionMetadataPort>(CompositionMetadataPort as symbol)).toBeDefined();
    expect(app.get<CompositionLayoutPort>(CompositionLayoutPort as symbol)).toBeDefined();
    expect(app.get<AdvanceProjetoStatusPort>(AdvanceProjetoStatusPort as symbol)).toBeDefined();
  });

  it('getContentTree returns a valid fixture tree by default', async () => {
    const app = await buildModule();
    const port = app.get<ManuscriptContentPort>(ManuscriptContentPort as symbol);
    const tree = await port.getContentTree('proj-1', '');
    expect(tree).not.toBeNull();
    expect(tree!.manuscritoId).toContain('proj-1');
    expect(Array.isArray(tree!.estrutura)).toBe(true);
    expect((tree!.estrutura as unknown[]).length).toBeGreaterThan(0);
  });

  it('getContentTree returns null when PUB_MANUSCRIPT_STUB_NULL=true (pre-flight 409 path)', async () => {
    process.env['PUB_MANUSCRIPT_STUB_NULL'] = 'true';
    const app = await buildModule();
    const port = app.get<ManuscriptContentPort>(ManuscriptContentPort as symbol);
    expect(await port.getContentTree('proj-1', '')).toBeNull();
  });

  it('CompositionMetadataPort.get returns fixture with titulo/autor/idioma by default', async () => {
    const app = await buildModule();
    const port = app.get<CompositionMetadataPort>(CompositionMetadataPort as symbol);
    const meta = await port.get('proj-1');
    expect(meta).not.toBeNull();
    expect(meta!.titulo).toBe('Livro Stub');
    expect(meta!.autor).toBe('Autor Stub');
    expect(meta!.idioma).toBe('pt-BR');
  });

  it('CompositionMetadataPort.get returns null when PUB_METADADOS_STUB_NULL=true (pre-flight 422 path)', async () => {
    process.env['PUB_METADADOS_STUB_NULL'] = 'true';
    const app = await buildModule();
    const port = app.get<CompositionMetadataPort>(CompositionMetadataPort as symbol);
    expect(await port.get('proj-1')).toBeNull();
  });

  it('CompositionLayoutPort.get returns default layout', async () => {
    const app = await buildModule();
    const port = app.get<CompositionLayoutPort>(CompositionLayoutPort as symbol);
    const layout = await port.get('proj-1');
    expect(layout).not.toBeNull();
    expect(layout!.fonteCorpoFamilia).toBe('serif');
  });

  it('AdvanceProjetoStatusPort.advanceTo returns expected result', async () => {
    const app = await buildModule();
    const port = app.get<AdvanceProjetoStatusPort>(AdvanceProjetoStatusPort as symbol);
    const result = await port.advanceTo({ projetoId: 'proj-1', targetStatus: 'publicado' }, '');
    expect(result.projetoId).toBe('proj-1');
    expect(result.newStatus).toBe('publicado');
    expect(result.changed).toBe(true);
  });
});
