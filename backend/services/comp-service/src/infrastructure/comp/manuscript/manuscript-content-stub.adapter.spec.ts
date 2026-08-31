import { ManuscriptContentStubAdapter } from './manuscript-content-stub.adapter';

// ---------------------------------------------------------------------------
// Mock fs/promises so tests never touch the real filesystem.
// ---------------------------------------------------------------------------
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

const FIXTURE: object = {
  manuscritoId: '00000000-0000-0000-0000-000000000001',
  estrutura: [
    { nodeId: 'node-001', tipo: 'capitulo', children: [] },
  ],
};

describe('ManuscriptContentStubAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.COMP_STUB_MANUSCRIPT_FIXTURE_PATH;
    delete process.env.COMP_STUB_NO_MANUSCRIPT_IDS;
    mockReadFile.mockResolvedValue(JSON.stringify(FIXTURE) as unknown as Buffer);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getContentTree — normal projetoId', () => {
    it('returns the fixture content tree with the requested projetoId', async () => {
      const adapter = new ManuscriptContentStubAdapter();
      const result = await adapter.getContentTree('proj-abc');

      expect(result).not.toBeNull();
      expect(result!.manuscritoId).toBe('proj-abc');
      expect(result!.estrutura).toHaveLength(1);
      expect((result!.estrutura[0] as { nodeId: string }).nodeId).toBe('node-001');
    });

    it('caches the fixture — readFile is called only once across multiple calls', async () => {
      const adapter = new ManuscriptContentStubAdapter();

      await adapter.getContentTree('proj-1');
      await adapter.getContentTree('proj-2');

      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('uses COMP_STUB_MANUSCRIPT_FIXTURE_PATH when set', async () => {
      process.env.COMP_STUB_MANUSCRIPT_FIXTURE_PATH = '/custom/path/fixture.json';
      const adapter = new ManuscriptContentStubAdapter();
      await adapter.getContentTree('proj-abc');

      expect(mockReadFile).toHaveBeenCalledWith('/custom/path/fixture.json', 'utf-8');
    });
  });

  describe('getContentTree — COMP_STUB_NO_MANUSCRIPT_IDS', () => {
    it('returns null for a projetoId listed in COMP_STUB_NO_MANUSCRIPT_IDS', async () => {
      process.env.COMP_STUB_NO_MANUSCRIPT_IDS =
        'id-no-1,id-no-2';
      const adapter = new ManuscriptContentStubAdapter();

      const result1 = await adapter.getContentTree('id-no-1');
      const result2 = await adapter.getContentTree('id-no-2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      // readFile must NOT be called for these IDs (skip even loading the fixture)
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('returns fixture for a projetoId NOT in COMP_STUB_NO_MANUSCRIPT_IDS', async () => {
      process.env.COMP_STUB_NO_MANUSCRIPT_IDS = 'id-no-1';
      const adapter = new ManuscriptContentStubAdapter();

      const result = await adapter.getContentTree('proj-other');

      expect(result).not.toBeNull();
      expect(result!.manuscritoId).toBe('proj-other');
    });

    it('handles leading/trailing spaces in the comma-separated list', async () => {
      process.env.COMP_STUB_NO_MANUSCRIPT_IDS = ' id-no-1 , id-no-2 ';
      const adapter = new ManuscriptContentStubAdapter();

      expect(await adapter.getContentTree('id-no-1')).toBeNull();
      expect(await adapter.getContentTree('id-no-2')).toBeNull();
    });

    it('handles empty COMP_STUB_NO_MANUSCRIPT_IDS gracefully', async () => {
      process.env.COMP_STUB_NO_MANUSCRIPT_IDS = '';
      const adapter = new ManuscriptContentStubAdapter();

      const result = await adapter.getContentTree('proj-any');
      expect(result).not.toBeNull();
    });
  });

  describe('readFile failure', () => {
    it('propagates errors from readFile', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: file not found'));
      const adapter = new ManuscriptContentStubAdapter();

      await expect(adapter.getContentTree('proj-abc')).rejects.toThrow('ENOENT');
    });
  });
});
