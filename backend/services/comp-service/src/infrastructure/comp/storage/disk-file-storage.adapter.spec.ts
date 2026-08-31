import { DiskFileStorageAdapter } from './disk-file-storage.adapter';

// ---------------------------------------------------------------------------
// Mock fs/promises — tests must never write to the real filesystem.
// ---------------------------------------------------------------------------
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

import { mkdir, writeFile, unlink } from 'fs/promises';
const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;

describe('DiskFileStorageAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.COMP_STORAGE_DIR;

    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('store', () => {
    it('creates the directory (recursive) and writes the file', async () => {
      const adapter = new DiskFileStorageAdapter();
      const buffer = Buffer.from('cover-image-bytes');

      await adapter.store('slug/proj-1/capa.jpg', buffer);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/slug.proj-1/),
        { recursive: true },
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('capa.jpg'),
        buffer,
      );
    });

    it('returns a file:// URL pointing to the stored file', async () => {
      const adapter = new DiskFileStorageAdapter();
      const url = await adapter.store('proj/capa.png', Buffer.from('x'));

      expect(url).toMatch(/^file:\/\//);
      expect(url).toContain('capa.png');
    });

    it('uses COMP_STORAGE_DIR when set', async () => {
      process.env.COMP_STORAGE_DIR = '/custom/storage';
      const adapter = new DiskFileStorageAdapter();
      const url = await adapter.store('proj/capa.jpg', Buffer.from('x'));

      expect(url).toContain('custom');
      expect(url).toContain('proj');
      expect(url).toContain('capa.jpg');
    });

    it('creates intermediate directories for nested keys', async () => {
      const adapter = new DiskFileStorageAdapter();
      await adapter.store('a/b/c/capa.jpg', Buffer.from('x'));

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true },
      );
    });
  });

  describe('delete', () => {
    it('calls unlink with the resolved path', async () => {
      const adapter = new DiskFileStorageAdapter();
      await adapter.delete('proj/capa.jpg');

      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('capa.jpg'));
    });

    it('does NOT throw when the file does not exist (ENOENT)', async () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockUnlink.mockRejectedValue(enoent);
      const adapter = new DiskFileStorageAdapter();

      await expect(adapter.delete('proj/missing.jpg')).resolves.toBeUndefined();
    });

    it('re-throws errors other than ENOENT', async () => {
      const permError = Object.assign(new Error('EACCES'), { code: 'EACCES' });
      mockUnlink.mockRejectedValue(permError);
      const adapter = new DiskFileStorageAdapter();

      await expect(adapter.delete('proj/capa.jpg')).rejects.toThrow('EACCES');
    });
  });
});
